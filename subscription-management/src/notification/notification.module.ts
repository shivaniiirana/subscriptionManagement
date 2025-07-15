import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [forwardRef(() => SubscriptionModule)],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
