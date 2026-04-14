import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BillingPeriodOverride, Prisma } from '@prisma/client';

@Injectable()
export class BillingPeriodActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOverride(
    templateId: string,
    periodStart: Date,
  ): Promise<BillingPeriodOverride | null> {
    return this.prisma.billingPeriodOverride.findUnique({
      where: {
        templateId_periodStart: { templateId, periodStart },
      },
    });
  }

  async findOverridesByTemplate(
    templateId: string,
  ): Promise<BillingPeriodOverride[]> {
    return this.prisma.billingPeriodOverride.findMany({
      where: { templateId },
      orderBy: { periodStart: 'desc' },
    });
  }

  async upsertOverride(
    templateId: string,
    periodStart: Date,
    overrideResetDate: Date,
  ): Promise<BillingPeriodOverride> {
    return this.prisma.billingPeriodOverride.upsert({
      where: {
        templateId_periodStart: { templateId, periodStart },
      },
      create: {
        templateId,
        periodStart,
        overrideResetDate,
      },
      update: {
        overrideResetDate,
      },
    });
  }

  async deleteOverride(id: string): Promise<void> {
    await this.prisma.billingPeriodOverride.delete({ where: { id } });
  }
}
