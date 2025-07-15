import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefundDocument = Refund & Document;

@Schema({ timestamps: true })
export class Refund {

  @Prop({ required: true })
  customerId: string;

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId?: Types.ObjectId;


  amount: number;

  @Prop()
  charge?: string;

  @Prop()
  paymentIntent?: string;

  refundAmount?: number;

  refundReason?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
