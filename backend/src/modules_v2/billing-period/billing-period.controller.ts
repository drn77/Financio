import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { BillingPeriodContextService } from './billing-period-context.service';

@Controller('v2/templates/:templateId/billing-period')
@UseGuards(SessionAuthGuard)
export class BillingPeriodController {
  constructor(private readonly billingPeriodContext: BillingPeriodContextService) {}

  @Get()
  async getCurrentPeriod(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.billingPeriodContext.getCurrentPeriodInfo(templateId, familyId);
  }

  @Post('override')
  async overrideResetDate(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Body() body: { overrideResetDate: string },
  ) {
    return this.billingPeriodContext.overrideResetDate(
      templateId,
      familyId,
      body.overrideResetDate,
    );
  }

  @Delete('override/:overrideId')
  async deleteOverride(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Param('overrideId') overrideId: string,
  ) {
    return this.billingPeriodContext.deleteOverride(templateId, familyId, overrideId);
  }

  @Get('history')
  async getPeriodHistory(
    @FamilyId() familyId: string,
    @Param('templateId') templateId: string,
    @Query('count') count?: string,
  ) {
    return this.billingPeriodContext.getPeriodHistory(
      templateId,
      familyId,
      count ? parseInt(count, 10) : 6,
    );
  }
}
