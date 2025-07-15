import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

@Schema()
export class Plan {
  @Prop({ required: true }) stripeProductId: string;
  @Prop({ required: true }) stripePriceId: string;
  description: string;
  @Prop() name: string;
  @Prop() interval: string;
  @Prop() amount: number;
  @Prop() currency: string;
  @Prop() trialPeriodDays: number;
  @Prop({ default: true }) active: boolean;
  @Prop() type: string;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
