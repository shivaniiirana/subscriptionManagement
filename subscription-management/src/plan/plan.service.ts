import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { StripeService } from '../stripe/stripe.service';
import Stripe from 'stripe';

@Injectable()
export class PlanService {
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
    private readonly stripeService: StripeService,
  ) {
    this.stripe = this.stripeService.client;
  }

  async syncPlansFromStripe(): Promise<void> {
    const prices = await this.stripe.prices.list({ expand: ['data.product'] });

    for (const price of prices.data) {
      const product = price.product as Stripe.Product;

      await this.planModel.findOneAndUpdate(
        { stripePriceId: price.id },
        {
          stripePriceId: price.id,
          stripeProductId: product.id,
          name: product.name,
          interval: price.recurring?.interval,
          amount: price.unit_amount,
          currency: price.currency,
        },
        { upsert: true },
      );
    }
  }

  async getAllPlansService() {
    return this.planModel.find();
  }

  async getPlanByIdService(id: string) {
    return this.planModel.findById(id);
  }
}
