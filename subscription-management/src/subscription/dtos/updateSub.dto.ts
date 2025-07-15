import { ApiProperty } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
  @ApiProperty({
    example: 'price_1RjIoPPYpcl2EDzo8FIA9E2T',
    description: 'The new Stripe Price ID to update the subscription with',
  })
  newPriceId: string;
}
