import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeEvent, StripeEventSchema } from './schemas/stripeEvent.schema';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { PlanModule } from 'src/plan/plan.module';

@Module({
  imports:[MongooseModule.forFeature([{name:StripeEvent.name, schema:StripeEventSchema}]), SubscriptionModule, StripeModule, PlanModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
