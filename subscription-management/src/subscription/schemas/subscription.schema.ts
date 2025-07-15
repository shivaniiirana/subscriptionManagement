import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {

  email: string;

  name: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  stripeSubscriptionId: string;

  @Prop({ required: true })
  stripePriceId: string;

  @Prop({ required: true })
  status: string;

  @Prop({ default: false })
  cancelAtPeriodEnd: boolean;

 
  @Prop({ type: String, default: null })
  scheduledDowngradePriceId: string | null; 

  @Prop({ type: String, default: null })
  stripeScheduleId: string | null; 

  @Prop({ type: Date, default: null })
  scheduledDowngradeDate: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodStart?: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodEnd?: Date;

  @Prop({ type: Date, default: null })
  startedAt?: Date | null;

  @Prop({ type: Date, default: null })
  endedAt?: Date | null;

  @Prop({ type: Date, default: null })
  cancellationDate?: Date | null;

  @Prop({ type: Date, default: null })
  canceledAt?: Date | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
