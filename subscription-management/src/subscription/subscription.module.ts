import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { StripeService } from 'src/stripe/stripe.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import { Refund, RefundSchema } from './schemas/refund.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Refund.name, schema: RefundSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => NotificationModule), 
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, StripeService],
  exports: [SubscriptionService, MongooseModule],
})
export class SubscriptionModule {}
