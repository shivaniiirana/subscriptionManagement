import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from './schemas/subscription.schema';
import { StripeService } from '../stripe/stripe.service';
import Stripe from 'stripe';
import { Refund, RefundDocument } from './schemas/refund.schema';
import {
  sendSubscriptionEmail,
  SubscriptionEventType,
} from 'src/notification/helper/email.helper';
import { NotificationService } from 'src/notification/notification.service';
import { User, UserDocument } from 'src/user/schemas/user.schema';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    private readonly stripeService: StripeService,
    private readonly notificationService: NotificationService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Creates a subscription for a stripe customer using the provided payment method and price.
   * Also stores subscription details in the database and sends a confirmation email.
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId: string,
  ): Promise<any> {
    const stripe = this.stripeService.client;
    // Log the incoming subscription creation request

    const user = await this.userModel.findOne({ stripeCustomerId: customerId });
    console.log(user);
    const email1 = user?.email;
    const name1 = user?.name;

    this.logger.log(
      `Received createSubscription request for customerId: ${customerId}, priceId: ${priceId}`,
    );

    // Attach the payment method to the customer
    this.logger.log('Attaching payment method to customer');
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set the attached payment method as the default for invoices
    this.logger.log('Setting default payment method for customer');
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Check for an existing active or trialing subscription for this customer
    this.logger.log('Checking for existing active subscription');
    const existingSub = await this.subscriptionModel.findOne({
      customerId,
      status: { $in: ['active', 'trialing'] },
    });

    if (existingSub) {
      this.logger.warn(`User ${customerId} already has an active subscription`);
      throw new BadRequestException('User already has an active subscription.');
    }

    // Create the subscription in Stripe
    this.logger.log('Creating subscription in Stripe');
    const stripeSub: Stripe.Subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent', 'latest_invoice.charge'],
      metadata: {},
    });

    this.logger.log(`Stripe subscription created: ${stripeSub.id}`);

    // Extract period info from the subscription
    const item = stripeSub.items.data[0];

    // Convert Stripe timestamps to JS Dates
    const currentPeriodStart = stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000)
      : null;

    const currentPeriodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : null;

    // Get the latest invoice and payment intent
    const invoice = stripeSub.latest_invoice as Stripe.Invoice & {
      payment_intent?: any;
    };
    let chargeId = (invoice as any).charge;
    const invoiceStatus = invoice.status;
    const paymentIntent = invoice.payment_intent as
      | Stripe.PaymentIntent
      | undefined;

    // If chargeId is not present on invoice, try to get it from payment intent
    const piWithCharges = paymentIntent as
      | (Stripe.PaymentIntent & { charges?: { data: Array<{ id: string }> } })
      | undefined;
    if (
      !chargeId &&
      piWithCharges &&
      piWithCharges.charges &&
      piWithCharges.charges.data.length > 0
    ) {
      chargeId = piWithCharges.charges.data[0].id;
    }

    // Handle different payment/invoice statuses
    if (invoiceStatus === 'paid') {
      if (!chargeId) {
        this.logger.warn('Invoice paid but no chargeId found.');
      }
    } else if (paymentIntent && paymentIntent.status === 'requires_action') {
      this.logger.warn('Payment requires authentication');
      return {
        message: 'Payment requires additional authentication.',
        clientSecret: paymentIntent.client_secret,
        status: 'requires_action',
      };
    } else if (
      paymentIntent &&
      paymentIntent.status === 'requires_payment_method'
    ) {
      this.logger.warn('Payment failed. New method needed.');
      return {
        message: 'Payment failed, please provide a new payment method.',
        status: 'requires_payment_method',
      };
    } else {
      throw new BadRequestException(
        'Subscription was created but payment was not successful. Please try again.',
      );
    }

    // Save the subscription to the database
    this.logger.log('Saving subscription to database');
    const subscription = await this.subscriptionModel.findOneAndUpdate(
      { stripeSubscriptionId: stripeSub.id },
      {
        customerId: stripeSub.customer as string,
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: item?.price.id,
        status: stripeSub.status,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        currentPeriodStart,
        currentPeriodEnd,
        startedAt: stripeSub.start_date
          ? new Date(stripeSub.start_date * 1000)
          : null,
        endedAt: null,
        cancellationDate: null,
        metadata: {},
      },
      { new: true, upsert: true },
    );

    this.logger.log(`Subscription saved to DB: ${subscription._id}`);

    // Send a confirmation email to the user
    this.logger.log(`Sending confirmation email to ${email1}`);
    if (!email1) {
      this.logger.warn('User email not found, skipping notification');
      return;
    }

    await sendSubscriptionEmail(
      this.notificationService,
      { name: name1, email: email1 },
      SubscriptionEventType.CREATED,
    );
    this.logger.log(`Confirmation email sent to ${email1}`);

    // Return the subscription creation result
    return {
      message: 'Subscription created successfully',
      subscriptionId: stripeSub.id,
      status: stripeSub.status,
      invoiceStatus,
      chargeId,
    };
  }

  /**
   * Finds the active subscription for a given customer ID.
   */
  async findOne(id: string) {
    this.logger.log(`Finding active subscription for customerId: ${id}`);
    return this.subscriptionModel.findOne({ customerId: id, status: 'active' });
  }

  /**
   * Returns all subscriptions in the database.
   */
  async findAll() {
    this.logger.log('Retrieving all subscriptions');
    return this.subscriptionModel.find();
  }

  /**
   * Syncs a subscription from Stripe by its Stripe subscription ID.
   */
  async syncSubscriptionByStripeId(stripeSubscriptionId: string) {
    this.logger.log(
      `Syncing subscription from Stripe: ${stripeSubscriptionId}`,
    );
    const stripeSub =
      await this.stripeService.client.subscriptions.retrieve(
        stripeSubscriptionId,
      );

    // Convert Stripe timestamps to JS Dates
    const currentPeriodStart = stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000)
      : null;

    const currentPeriodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : null;

    // Update or insert the subscription in the database
    const subscription = await this.subscriptionModel.findOneAndUpdate(
      { stripeSubscriptionId },
      {
        userId: stripeSub.metadata?.userId
          ? new Types.ObjectId(stripeSub.metadata.userId)
          : undefined,
        customerId: stripeSub.customer as string,
        // stripePriceId: item?.price.id  ,
        status: stripeSub.status,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        currentPeriodStart,
        currentPeriodEnd,
        startedAt: stripeSub.start_date
          ? new Date(stripeSub.start_date * 1000)
          : null,
        metadata: stripeSub.metadata || {},
      },
      { new: true, upsert: true },
    );

    this.logger.log(`Subscription synced: ${subscription?._id}`);
    return subscription;
  }

  /**
   * Upgrades a subscription to a new price.
   */
  async upgradeSubscription(id: string, newPriceId: string) {
    this.logger.log(`Upgrading subscription ${id} to new price ${newPriceId}`);
    const sub = await this.subscriptionModel.findById(id);
    if (!sub) throw new NotFoundException('Subscription not found');
    const userId = sub.customerId;
    const user = await this.userModel.findOne({ stripeCustomerId: userId });
    const email = user?.email;
    const name = user?.name;

    const stripe = this.stripeService.client;

    const stripeSub = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId,
    );
    const subscriptionItemId = stripeSub.items.data[0]?.id;
    if (!subscriptionItemId)
      throw new NotFoundException('Stripe subscription item not found');

    // Update the subscription in Stripe
    const updatedStripeSub = await stripe.subscriptions.update(
      sub.stripeSubscriptionId,
      {
        items: [{ id: subscriptionItemId, price: newPriceId }],
        proration_behavior: 'always_invoice',
      },
    );

    // Convert Stripe timestamps to JS Dates
    const currentPeriodStart = stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000)
      : null;

    const currentPeriodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : null;

    if (email) {
      this.logger.log(`Sending upgrade email to ${email}`);
      await sendSubscriptionEmail(
        this.notificationService,
        { name, email },
        SubscriptionEventType.UPGRADED,
      );
    }

    // Update the subscription in the database
    return await this.subscriptionModel.findByIdAndUpdate(
      id,
      {
        stripePriceId: newPriceId,
        status: updatedStripeSub.status,
        cancelAtPeriodEnd: updatedStripeSub.cancel_at_period_end,
        currentPeriodStart,
        currentPeriodEnd,
        metadata: updatedStripeSub.metadata || {},
        updatedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Schedules a downgrade for a subscription at the end of the current period.
   */
  async scheduleDowngrade(id: string, newPriceId: string) {
    const sub = await this.subscriptionModel.findById(id);
    if (!sub) throw new NotFoundException('Subscription not found');
    const userId = sub.customerId;
    const user = await this.userModel.findOne({ stripeCustomerId: userId });
    const email = user?.email;
    const name = user?.name;

    const stripe = this.stripeService.client;
    let scheduleId = sub.stripeScheduleId;

    try {
      // If schedule ID not stored, retrieve from Stripe
      if (!scheduleId) {
        const stripeSub = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId,
          { expand: ['schedule'] },
        );
        scheduleId = (stripeSub.schedule as Stripe.SubscriptionSchedule)?.id;
      }

      // Get period end timestamp in seconds
      if (!sub.currentPeriodEnd) {
        throw new Error(
          'Subscription is not in a period that can be downgraded',
        );
      }
      const currentPeriodEnd = Math.floor(
        sub.currentPeriodEnd.getTime() / 1000,
      );
      const now = Math.floor(Date.now() / 1000);

      if (scheduleId) {
        // Update existing schedule
        const schedule =
          await stripe.subscriptionSchedules.retrieve(scheduleId);

        const currentPhase = schedule.phases.find(
          (p) => p.start_date <= now && p.end_date > now,
        );

        if (!currentPhase) {
          throw new BadRequestException('No current phase found in schedule.');
        }

        const existingPhases: Stripe.SubscriptionScheduleUpdateParams['phases'] =
          schedule.phases.map((phase) => ({
            items: phase.items.map((item) => ({
              price:
                typeof item.price === 'string' ? item.price : item.price.id, // Ensure string
            })),
            start_date: phase.start_date,
            end_date: phase.end_date,
            proration_behavior: phase.proration_behavior as
              | 'create_prorations'
              | 'none'
              | 'always_invoice'
              | undefined,
          }));

        // Add the new downgrade phase at the end
        existingPhases.push({
          items: [{ price: newPriceId }],
          start_date: currentPhase.end_date,
          proration_behavior: 'none',
        });

        await stripe.subscriptionSchedules.update(scheduleId, {
          phases: existingPhases,
          end_behavior: 'release',
        });
      } else {
        // Create new schedule from subscription
        const createdSchedule = await stripe.subscriptionSchedules.create({
          from_subscription: sub.stripeSubscriptionId,
        });

        await stripe.subscriptionSchedules.update(createdSchedule.id, {
          phases: [
            {
              items: [{ price: sub.stripePriceId }],
              start_date: 'now',
              end_date: currentPeriodEnd,
            },
            {
              items: [{ price: newPriceId }],
              start_date: currentPeriodEnd,
              proration_behavior: 'none',
            },
          ],
          end_behavior: 'release',
        });

        scheduleId = createdSchedule.id;
      }
      // Send downgrade notification
      if (email) {
        this.logger.log(`Sending downgrade notification to ${email}`);
        await sendSubscriptionEmail(
          this.notificationService,
          { name, email },
          SubscriptionEventType.DOWNGRADED,
        );
      }

      // Update MongoDB record
      return await this.subscriptionModel.findByIdAndUpdate(
        id,
        {
          stripeScheduleId: scheduleId,
          scheduledDowngradePriceId: newPriceId,
          scheduledDowngradeDate: sub.currentPeriodEnd,
          updatedAt: new Date(),
        },
        { new: true },
      );
    } catch (err: any) {
      console.error('Stripe Error Details:', err);
      if (err.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(
          'Failed to schedule downgrade: ' + err.message,
        );
      }
      throw err;
    }
  }

  /**
   * Cancels a subscription immediately. If cancelled within 3 days of start, issues a full refund; otherwise, issues a prorated refund.
   */
  async cancelSubscription(subscriptionId: string) {
    this.logger.log(`Cancelling subscription: ${subscriptionId}`);
    // Find subscription in database
    let sub: SubscriptionDocument | null =
      await this.subscriptionModel.findById(subscriptionId);
    if (!sub) {
      sub = await this.subscriptionModel.findOne({
        stripeSubscriptionId: subscriptionId,
      });
    }
    if (!sub) throw new NotFoundException('Subscription not found');
    const userId = sub.customerId;
    const user = await this.userModel.findOne({ stripeCustomerId: userId });
    const email = user?.email;
    const name = user?.name;

    const stripe = this.stripeService.client;

    // Retrieve subscription with expanded invoice and payment intent
    const stripeSub = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId,
      {
        expand: ['latest_invoice.payment_intent'],
      },
    );

    // Calculate proration
    const startUnix = stripeSub.current_period_start;
    const endUnix = stripeSub.current_period_end;
    const nowUnix = Math.floor(Date.now() / 1000);
    const daysTotal = Math.ceil((endUnix - startUnix) / 86400);
    const daysUsed = Math.ceil((nowUnix - startUnix) / 86400);
    const daysUnused = daysTotal - daysUsed;

    // Cancel the subscription in Stripe
    this.logger.log('Cancelling subscription in Stripe');
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);

    // Handle refund logic
    let refundResult: Stripe.Refund | null = null;
    const latestInvoice = stripeSub.latest_invoice as Stripe.Invoice;

    if (latestInvoice && typeof latestInvoice === 'object') {
      try {
        // Retrieve full invoice with expanded payment intent
        this.logger.log('Retrieving invoice for refund calculation');
        const invoice = await stripe.invoices.retrieve(latestInvoice.id, {
          expand: ['payment_intent'],
        });

        // Get payment intent (either expanded or retrieved separately)
        const paymentIntent =
          typeof invoice.payment_intent === 'string'
            ? await stripe.paymentIntents.retrieve(invoice.payment_intent)
            : invoice.payment_intent;

        if (paymentIntent && paymentIntent.latest_charge) {
          const chargeId = paymentIntent.latest_charge as string;
          const amountPaid = invoice.amount_paid;

          // Determine refund amount (full if within 3 days, otherwise prorated)
          let refundAmount: number | undefined;
          if (daysUsed <= 3) {
            this.logger.log('Issuing full refund');
            refundAmount = amountPaid;
          } else {
            // Calculate prorated amount
            const unusedPercentage = daysUnused / daysTotal;
            refundAmount = Math.floor(amountPaid * unusedPercentage);
            this.logger.log(`Issuing prorated refund: ${refundAmount}`);
          }

          // Create refund in Stripe
          if (refundAmount > 0) {
            this.logger.log('Creating refund in Stripe');
            refundResult = await stripe.refunds.create({
              charge: chargeId,
              amount: refundAmount,
              reason: 'requested_by_customer',
            });
            this.logger.log('Refund successful');
          }
        }
      } catch (error) {
        this.logger.error('Error processing refund:', error);
        // Continue with cancellation even if refund fails
      }
    }

    // Update subscription status in the database
    this.logger.log('Updating subscription status in database');
    const updatedSubscription = await this.subscriptionModel.findByIdAndUpdate(
      sub._id,
      {
        status: 'cancelled',
        canceledAt: new Date(),
        endedAt: stripeSub.ended_at
          ? new Date(stripeSub.ended_at * 1000)
          : new Date(),
        cancellationDate: new Date(),
        metadata: stripeSub.metadata || {},
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!updatedSubscription) {
      this.logger.error('Failed to update subscription in database');
      throw new InternalServerErrorException('Failed to update subscription');
    }

    // Record the refund in the refund collection
    this.logger.log('Recording refund in database');
    const invoice = stripeSub.latest_invoice as Stripe.Invoice;

    await this.refundModel.create({
      customerId: updatedSubscription.customerId,
      subscriptionId: updatedSubscription._id,
      refundAmount: invoice?.amount_paid ?? 0,
      refundReason: 'Subscription cancelled',
      refundedAt: new Date(),
    });
    if (email) {
      this.logger.log(`Sending cancellation email to ${email}`);
      await sendSubscriptionEmail(
        this.notificationService,
        { name, email },
        SubscriptionEventType.CANCELLED,
      );
    }
  }
}
