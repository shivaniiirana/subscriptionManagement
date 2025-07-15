import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class StripeEvent extends Document {
  @Prop({ type: String }) // Define _id as a String
  declare _id: string; // Use 'declare' to avoid overwriting the base property

  @Prop({ required: true })
  type: string;
}

export const StripeEventSchema = SchemaFactory.createForClass(StripeEvent);
