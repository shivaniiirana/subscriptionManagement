import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'pm_1NxxxX2eZvKYlo2C0XXXXXX',
    description:
      'The Stripe Payment Method ID to be used for this subscription',
  })
  paymentMethodId: string;

  @ApiProperty({
    example: 'cus_NxxxxX2eZvKYlo2CXXXXXX',
    description: 'The Stripe Customer ID associated with the user',
  })
  customerId: string;

  @ApiProperty({
    example: 'price_1NxxxX2eZvKYlo2CXxXXXXXX',
    description: 'The Stripe Price ID of the plan the user is subscribing to',
  })
  priceId: string;
}
