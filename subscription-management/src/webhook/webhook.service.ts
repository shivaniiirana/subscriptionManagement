import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { StripeService } from '../stripe/stripe.service';
import { StripeEvent } from './schemas/stripeEvent.schema';
import { Plan, PlanDocument } from 'src/plan/schemas/plan.schema';
import { SubscriptionService } from 'src/subscription/subscription.service';

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
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly subService:SubscriptionService,
  ) {}

  async handleEvent(rawBody: Buffer, sig: string | string[]) {
    const endpointSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;
    try {
      event = this.stripeService.client.webhooks.constructEvent(
        rawBody,
        sig,
        endpointSecret as string,
      );
    } catch (err) {
      this.logger.error('Invalid Stripe Signature', err.message);
      throw new Error('Invalid Stripe Signature');
    }

    // Avoid processing duplicate events
    const exists = await this.eventModel.findById(event.id);
    if (exists) {
      this.logger.warn(`Duplicate event received: ${event.id}`);
      return;
    }

    // Save the event to prevent reprocessing
    await this.eventModel.create({ _id: event.id, type: event.type });

    const stripe = this.stripeService.client;

    try {
      switch (event.type) {
        case 'product.created': {
          const product = event.data.object as Stripe.Product;
          await this.planModel.findOneAndUpdate(
            { stripeProductId: product.id },
            {
              stripeProductId: product.id,
              name: product.name,
              description: product.description,
              active: product.active,
            },
            { upsert: true, new: true },
          );
          this.logger.log(`Product created: ${product.id}`);
          break;
        }

        case 'product.updated': {
          const product = event.data.object as Stripe.Product;
          await this.planModel.updateMany(
            { stripeProductId: product.id },
            {
              name: product.name,
              active: product.active,
            },
          );
          this.logger.log(`Product updated: ${product.id}`);
          break;
        }

        case 'product.deleted': {
          const product = event.data.object as Stripe.Product;
          await this.planModel.updateMany(
            { stripeProductId: product.id },
            { active: false },
          );
          this.logger.log(`Product deleted: ${product.id}`);
          break;
        }

        case 'price.created': {
          const price = event.data.object as Stripe.Price;
          const productId =
            typeof price.product === 'string'
              ? price.product
              : price.product.id;

          // Update the existing product document with price details
          await this.planModel.findOneAndUpdate(
            { stripeProductId: productId },
            {
              $set: {
                stripePriceId: price.id,
                interval: price.recurring?.interval,
                amount: price.unit_amount,
                currency: price.currency,

                type: price.type,
                trialPeriodDays: price.recurring?.trial_period_days,
                active: true,
              },
            },
            { upsert: true, new: true },
          );
          this.logger.log(`Price created and linked to product: ${price.id}`);
          break;
        }

        case 'price.updated': {
          const price = event.data.object as Stripe.Price;
          const productId =
            typeof price.product === 'string'
              ? price.product
              : price.product.id;

          await this.planModel.findOneAndUpdate(
            { stripePriceId: price.id },
            {
              stripeProductId: productId,
              interval: price.recurring?.interval,
              amount: price.unit_amount,
              currency: price.currency,
              type: price.type,
              trialPeriodDays: price.recurring?.trial_period_days,
            },
          );
          this.logger.log(`Price updated: ${price.id}`);
          break;
        }

        case 'price.deleted': {
          const price = event.data.object as Stripe.Price;
          await this.planModel.findOneAndUpdate(
            { stripePriceId: price.id },
            { active: false },
          );
          this.logger.log(`Price deleted: ${price.id}`);
          break;
        }

        // SUBSCRIPTION EVENTS 
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.subService.syncSubscriptionByStripeId(subscription.id);
          this.logger.log(
            `Subscription event mirrored: ${event.type} for ${subscription.id}`,
          );
          break;
        }

        //INVOICE EVENTS
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
        case 'invoice.finalized':
        case 'invoice.marked_uncollectible':
        case 'invoice.voided':
        case 'invoice.paid':
        case 'invoice.upcoming':
        case 'invoice.sent':
        case 'invoice.payment_action_required': {
          const invoice = event.data.object as any;
          const stripeSubId = invoice.subscription;
          if (stripeSubId) {
            await this.subService.syncSubscriptionByStripeId(stripeSubId);
            this.logger.log(
              `Invoice event mirrored: ${event.type} for subscription ${stripeSubId}`,
            );
          } else {
            this.logger.warn(`No subscription ID in ${event.type}`);
          }
          break;
        }

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;

          const stripeSubscriptionId = session.subscription as string;

          if (!stripeSubscriptionId) {
            this.logger.warn('No subscription ID in session');
            break;
          }

          await this.subService.syncSubscriptionByStripeId(
            stripeSubscriptionId,
          );

          this.logger.log(
            `Stored subscription from checkout: ${stripeSubscriptionId}`,
          );
          break;
        }

        case 'invoice_payment.paid': {
          const invoice = event.data.object as InvoicePaymentData;

          const stripeSubId = invoice.subscription;
          if (!stripeSubId) {
            this.logger.warn('No subscription ID in invoice_payment.paid');
            break;
          }

          await this.subService.syncSubscriptionByStripeId(stripeSubId);
          this.logger.log(
            `Invoice paid. Synced subscription: ${stripeSubId}`,
          );
          break;
        }

        case 'subscription_schedule.canceled': {
          const subscription = event.data.object as any;
          if (subscription.id) {
            await this.subService.syncSubscriptionByStripeId(subscription.id);
            this.logger.log(
              `Subscription schedule canceled mirrored: ${subscription.id}`,
            );
          }
          break;
        }

        case 'invoice.updated': {
          const invoice = event.data.object as any;
          const stripeSubId = invoice.subscription;
          if (stripeSubId) {
            await this.subService.syncSubscriptionByStripeId(stripeSubId);
            this.logger.log(`Invoice updated mirrored: ${stripeSubId}`);
          }
          break;
        }

        case 'credit_note.created': {
          const creditNote = event.data.object as Stripe.CreditNote;
          this.logger.log(`Credit note created: ${creditNote.id}`);
          break;
        }

        case 'refund.created':
        case 'refund.updated': {
          const refund = event.data.object as Stripe.Refund;
          this.logger.log(
            `Refund event: ${event.type} for refund ${refund.id}`,
          );
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
