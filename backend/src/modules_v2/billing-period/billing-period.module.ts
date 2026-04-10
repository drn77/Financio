import { Module } from '@nestjs/common';
import { BillingPeriodController } from './billing-period.controller';
import { BillingPeriodContextService } from './billing-period-context.service';
import { BillingPeriodActionsService } from './billing-period-actions.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule],
  controllers: [BillingPeriodController],
  providers: [BillingPeriodContextService, BillingPeriodActionsService],
  exports: [BillingPeriodContextService],
})
export class BillingPeriodModule {}
