import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { StripeService } from '../stripe/stripe.service';
import { StripeEvent } from './schemas/stripeEvent.schema';
import { Plan, PlanDocument } from 'src/plan/schemas/plan.schema';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { User, UserDocument } from 'src/user/schemas/user.schema';
import { Refund, RefundDocument } from 'src/subscription/schemas/refund.schema';

interface InvoicePaymentData {
  subscription?: string;
  [key: string]: any;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectModel(StripeEvent.name)
    private readonly eventModel: Model<StripeEvent>,
    @InjectModel(Plan.name)
    private readonly planModel: Model<PlanDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly subService: SubscriptionService,
  ) {}

  async handleEvent(rawBody: Buffer, sig: string | string[]) {
    const endpointSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    const stripe = this.stripeService.client;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        endpointSecret as string,
      );
    } catch (err) {
      this.logger.error('Invalid Stripe Signature', err.message);
      throw new Error('Invalid Stripe Signature');
    }

    const exists = await this.eventModel.findById(event.id);
    if (exists) {
      this.logger.warn(`Duplicate event received: ${event.id}`);
      return;
    }

    await this.eventModel.create({ _id: event.id, type: event.type });

    try {
      switch (event.type) {
        //price and product events
        case 'product.created':
        case 'product.updated':
        case 'product.deleted': {
          const product = event.data.object as Stripe.Product;
          const update: any = {
            name: product.name,
            description: product.description,
            active: product.active,
          };
          if (event.type === 'product.deleted') update.active = false;

          await this.planModel.findOneAndUpdate(
            { stripeProductId: product.id },
            { stripeProductId: product.id, ...update },
            { upsert: true, new: true },
          );
          this.logger.log(`Product event processed: ${event.type}`);
          break;
        }

        case 'price.created':
        case 'price.updated':
        case 'price.deleted': {
          const price = event.data.object as Stripe.Price;
          const productId =
            typeof price.product === 'string'
              ? price.product
              : price.product.id;
          const update: any = {
            stripeProductId: productId,
            interval: price.recurring?.interval,
            amount: price.unit_amount,
            currency: price.currency,
            type: price.type,
            trialPeriodDays: price.recurring?.trial_period_days,
          };
          if (event.type === 'price.deleted') update.active = false;
          else update.active = true;

          await this.planModel.findOneAndUpdate(
            { stripePriceId: price.id },
            { stripePriceId: price.id, ...update },
            { upsert: true, new: true },
          );
          this.logger.log(`Price event processed: ${event.type}`);
          break;
        }

        //customer events
        case 'customer.created':
        case 'customer.updated': {
          const customer = event.data.object as Stripe.Customer;
          await this.userModel.findOneAndUpdate(
            { stripeCustomerId: customer.id },
            {
              stripeCustomerId: customer.id,
              email: customer.email,
              name: customer.name,
              metadata: customer.metadata,
            },
            { upsert: true, new: true },
          );
          this.logger.log(`Customer ${event.type}: ${customer.id}`);
          break;
        }

        //subscription events
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.subService.syncSubscriptionByStripeId(subscription.id);
          this.logger.log(`Subscription ${event.type}: ${subscription.id}`);
          break;
        }

        case 'subscription_schedule.updated':
        case 'subscription_schedule.canceled': {
          const schedule = event.data.object as Stripe.SubscriptionSchedule;
          if (schedule.subscription) {
            if (typeof schedule.subscription === 'string') {
              await this.subService.syncSubscriptionByStripeId(
                schedule.subscription,
              );
            }

            this.logger.log(`Subscription schedule synced: ${schedule.id}`);
          }
          break;
        }

        //invoice events
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
        case 'invoice.finalized':
        case 'invoice.marked_uncollectible':
        case 'invoice.voided':
        case 'invoice.paid':
        case 'invoice.upcoming':
        case 'invoice.sent':
        case 'invoice.payment_action_required':
        case 'invoice.updated': {
          const invoice = event.data.object as Stripe.Invoice;
          const stripeSubId = invoice.subscription;
          if (stripeSubId) {
            if (typeof stripeSubId === 'string') {
              await this.subService.syncSubscriptionByStripeId(stripeSubId);
            }

            this.logger.log(`Invoice event processed: ${event.type}`);
          }
          break;
        }

        case 'invoice_payment.paid': {
          const invoice = event.data.object as InvoicePaymentData;
          if (invoice.subscription) {
            await this.subService.syncSubscriptionByStripeId(
              invoice.subscription,
            );
            this.logger.log(`Invoice payment synced: ${invoice.subscription}`);
          }
          break;
        }

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const subscriptionId = session.subscription as string;
          if (subscriptionId) {
            await this.subService.syncSubscriptionByStripeId(subscriptionId);
            this.logger.log(`Checkout session completed: ${subscriptionId}`);
          }
          break;
        }

        //refund events
        case 'refund.created':
        case 'refund.updated': {
          const refund = event.data.object as Stripe.Refund;
          await this.refundModel.findOneAndUpdate(
            { stripeRefundId: refund.id },
            {
              stripeRefundId: refund.id,
              amount: refund.amount,
              reason: refund.reason,
              status: refund.status,
              chargeId: refund.charge,
              refundedAt: new Date(refund.created * 1000),
            },
            { upsert: true },
          );
          this.logger.log(`Refund recorded: ${refund.id}`);
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          this.logger.log(`Charge refunded: ${charge.id}`);
          break;
        }

        default:
          this.logger.warn(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error processing event ${event.id}: ${err.message}`);
      throw err;
    }
  }
}
