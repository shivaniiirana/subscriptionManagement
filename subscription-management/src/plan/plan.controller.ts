import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PlanService } from './plan.service';

@ApiTags('Plans')
@Controller('plan')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available plans' })
  @ApiResponse({
    status: 200,
    description: 'List of plans retrieved successfully.',
  })
  async getAllPlans() {
    return this.planService.getAllPlansService();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Plan ID' })
  @ApiResponse({
    status: 200,
    description: 'Plan details retrieved successfully.',
  })
  @ApiResponse({ status: 404, description: 'Plan not found.' })
  async getPlanById(@Param('id') id: string) {
    return this.planService.getPlanByIdService(id);
  }
}
