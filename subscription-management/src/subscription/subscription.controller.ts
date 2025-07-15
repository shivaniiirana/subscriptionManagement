import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subService: SubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        priceId: { type: 'string' },
        paymentMethodId: { type: 'string' },
      },
      required: ['customerId', 'priceId', 'paymentMethodId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
  })
  async create(
    @Body()
    body: {
      paymentMethodId: string;
      customerId: string;
        priceId: string;
    },
  ) {
    return this.subService.createSubscription(
      body.customerId,
      body.priceId,
      body.paymentMethodId,
     
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a subscription by ID' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200, description: 'Subscription found' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async findOne(@Param('id') id: string) {
    return this.subService.findOne(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  async findAll() {
    return this.subService.findAll();
  }

  @Patch('cancel/:id')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancelSubscription(@Param('id') id: string) {
    return this.subService.cancelSubscription(id);
  }

  @Patch('upgrade/:id')
  @ApiOperation({ summary: 'Upgrade a subscription' })
  @ApiParam({ name: 'id', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newPriceId: { type: 'string' },
      },
      required: ['newPriceId'],
    },
  })
  async upgrade(
    @Param('id') id: string,
    @Body('newPriceId') newPriceId: string,
  ) {
    return this.subService.upgradeSubscription(id, newPriceId);
  }

  @Patch('downgrade/:id')
  @ApiOperation({ summary: 'Schedule a subscription downgrade' })
  @ApiParam({ name: 'id', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newPriceId: { type: 'string' },
      },
      required: ['newPriceId'],
    },
  })
  async downgrade(
    @Param('id') id: string,
    @Body('newPriceId') newPriceId: string,
  ) {
    return this.subService.scheduleDowngrade(id, newPriceId);
  }
}
