import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BillingPeriodActionsService } from './billing-period-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import {
  calculatePeriodBoundaries,
  getBillingPeriodInfo,
  getPastPeriods,
} from '../../shared/billing-period/billing-period.utils';
import { RecordActionsService } from '../template/record-actions.service';
import type { IBillingPeriodConfig } from '../../shared/billing-period/billing-period.utils';

@Injectable()
export class BillingPeriodContextService {
  constructor(
    private readonly billingPeriodActions: BillingPeriodActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
  ) {}

  async getCurrentPeriodInfo(templateId: string, familyId: string) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) throw new NotFoundException('Template not found');

    const config = template.billingPeriod as IBillingPeriodConfig | null;
    if (!config?.type) {
      return null; // No billing period configured
    }

    const now = new Date();
    const { periodStart } = calculatePeriodBoundaries(config, now);

    // Check for override
    const override = await this.billingPeriodActions.findOverride(templateId, periodStart);
    const overrideDate = override ? new Date(override.overrideResetDate) : null;

    return getBillingPeriodInfo(config, now, overrideDate);
  }

  async overrideResetDate(
    templateId: string,
    familyId: string,
    newResetDate: string,
  ) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) throw new NotFoundException('Template not found');

    const config = template.billingPeriod as IBillingPeriodConfig | null;
    if (!config?.type) {
      throw new BadRequestException('No billing period configured for this template');
    }

    const now = new Date();
    const { periodStart } = calculatePeriodBoundaries(config, now);
    const resetDate = new Date(newResetDate);

    if (resetDate <= periodStart) {
      throw new BadRequestException('Override reset date must be after period start');
    }

    const override = await this.billingPeriodActions.upsertOverride(
      templateId,
      periodStart,
      resetDate,
    );

    return {
      ...getBillingPeriodInfo(config, now, resetDate),
      overrideId: override.id,
    };
  }

  async deleteOverride(
    templateId: string,
    familyId: string,
    overrideId: string,
  ) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) throw new NotFoundException('Template not found');

    await this.billingPeriodActions.deleteOverride(overrideId);
    return { message: 'Override deleted' };
  }

  async getPeriodHistory(
    templateId: string,
    familyId: string,
    count = 6,
  ) {
    const template = await this.templateActions.findTemplateById(templateId, familyId);
    if (!template) throw new NotFoundException('Template not found');

    const config = template.billingPeriod as IBillingPeriodConfig | null;
    if (!config?.type) return [];

    const periods = getPastPeriods(config, count);

    // Fetch all records for template (within reasonable limits)
    const { records } = await this.recordActions.findRecordsByTemplate(templateId, {
      take: 10000,
      orderBy: 'asc',
    });

    return periods.map(({ periodStart, periodEnd }) => {
      const startStr = periodStart.toISOString().split('T')[0];
      const endStr = periodEnd.toISOString().split('T')[0];

      const periodRecords = records.filter((r: any) => {
        const date = r.data?.col_date;
        if (!date) return false;
        return date >= startStr && date < endStr;
      });

      let totalAmount = 0;
      for (const r of periodRecords) {
        const data = (r as any).data;
        const amountField = data?.col_amount;
        const amount =
          typeof amountField === 'object' && amountField?.amount != null
            ? Number(amountField.amount)
            : typeof amountField === 'number'
              ? amountField
              : 0;
        totalAmount += amount;
      }

      return {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalAmount: Math.round(totalAmount * 100) / 100,
        recordCount: periodRecords.length,
        budgetAmount: config.budgetAmount,
      };
    });
  }
}
