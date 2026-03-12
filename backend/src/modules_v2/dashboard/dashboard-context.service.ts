import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateDashboardConfigDto } from './dto/update-dashboard-config.dto';

export interface IDashboardExpenseByCategory {
  category: string;
  amount: number;
}

export interface IDashboardExpenseByPerson {
  person: string;
  amount: number;
}

export interface IDashboardBill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  nextDueDate: Date;
  isPaidThisMonth: boolean;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface IDashboardRecentRecord {
  id: string;
  data: any;
  createdAt: Date;
}

export interface IDashboardSummary {
  balance: number;
  balanceAfterPlanned: number;
  incurredCosts: number;
  plannedCosts: number;
  upcomingPlannedPayments: IDashboardPlannedPayment[];
  pendingReceiptOcrCount: number;
}

export interface IDashboardCategoryFieldOption {
  id: string;
  name: string;
  tagGroupId: string | null;
  tagGroupName: string | null;
}

export interface IDashboardConfig {
  categoryFieldId: string | null;
}

export interface IDashboardConfigResponse extends IDashboardConfig {
  availableCategoryFields: IDashboardCategoryFieldOption[];
}

export interface IDashboardPlannedPayment {
  id: string;
  source: 'bill' | 'fixed-expense' | 'savings';
  name: string;
  amount: number;
  currency: string;
  dueDate: Date;
}

export interface IDashboardData {
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
  expensesByCategory: IDashboardExpenseByCategory[];
  expensesByPerson: IDashboardExpenseByPerson[];
  upcomingBills: IDashboardBill[];
  recentRecords: IDashboardRecentRecord[];
}

@Injectable()
export class DashboardContextService {
  constructor(private readonly prisma: PrismaService) {}

  private _normalizeDashboardConfig(input: any): IDashboardConfig {
    return {
      categoryFieldId: typeof input?.categoryFieldId === 'string' && input.categoryFieldId.trim().length > 0
        ? input.categoryFieldId
        : null,
    };
  }

  private async _getCategoryFieldOptions(familyId: string): Promise<IDashboardCategoryFieldOption[]> {
    const [defaultTemplate, tagGroups] = await Promise.all([
      this.prisma.template.findFirst({
        where: { familyId, isDefault: true },
        select: { columns: true },
      }),
      this.prisma.tagGroup.findMany({
        where: { familyId },
        select: { id: true, name: true },
      }),
    ]);

    const tagGroupNameById: Record<string, string> = {};
    for (const group of tagGroups) {
      tagGroupNameById[group.id] = group.name;
    }

    const columns = Array.isArray(defaultTemplate?.columns) ? (defaultTemplate?.columns as any[]) : [];
    return columns
      .filter((c: any) => c?.type === 'tag_group' && typeof c?.id === 'string')
      .map((c: any) => {
        const tagGroupId = typeof c?.tagGroupId === 'string' ? c.tagGroupId : null;
        return {
          id: c.id,
          name: typeof c?.name === 'string' ? c.name : c.id,
          tagGroupId,
          tagGroupName: tagGroupId ? (tagGroupNameById[tagGroupId] ?? null) : null,
        };
      });
  }

  // #region Private
  private _computeNextDueDate(dueDay: number): Date {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);

    if (currentMonth >= now) {
      return currentMonth;
    }

    return new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
  }

  private _getPaidAmountForCurrentMonth(payments: { amount: any; dueDate: Date; paidAt: Date }[]): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return payments
      .filter((p) => new Date(p.dueDate) >= monthStart && new Date(p.dueDate) <= monthEnd)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  private _computeBillStatus(dueDay: number, paidAmount: number, billAmount: number): string {
    if (paidAmount >= billAmount) return 'PAID';

    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (paidAmount > 0) return 'PARTIALLY_PAID';
    if (daysUntilDue < 0) return 'OVERDUE';
    if (daysUntilDue === 0) return 'DUE_TODAY';

    return 'UPCOMING';
  }

  private _extractAmount(colAmount: any): number {
    if (!colAmount) return 0;
    if (typeof colAmount === 'number') return colAmount;
    if (typeof colAmount === 'object' && colAmount.amount) return Number(colAmount.amount);

    return 0;
  }

  private _computeNextDueDateByFrequency(from: Date, frequency: string, dayOfMonth?: number | null): Date {
    const targetDay = dayOfMonth ?? from.getDate();
    const clamp = (year: number, month: number, day: number) => {
      const max = new Date(year, month + 1, 0).getDate();
      const safeDay = Math.min(Math.max(day, 1), max);
      return new Date(year, month, safeDay);
    };

    switch (frequency) {
      case 'DAILY':
        return new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
      case 'WEEKLY':
        return new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
      case 'QUARTERLY':
        return clamp(from.getFullYear(), from.getMonth() + 3, targetDay);
      case 'YEARLY':
        return clamp(from.getFullYear() + 1, from.getMonth(), targetDay);
      case 'MONTHLY':
      default:
        return clamp(from.getFullYear(), from.getMonth() + 1, targetDay);
    }
  }

  /**
   * Classify a record as 'income', 'expense', 'planning' or null using tag mappings.
   * tagMappings values are tag IDs, but records store tag NAMES — so we need tagIdToName map.
   * Falls back to legacy col_type check if no tag mappings configured.
   */
  private _classifyRecord(
    data: any,
    columns: any[],
    tagMappings: { income?: string; expense?: string; planning?: string },
    tagIdToName: Record<string, string>,
  ): 'income' | 'expense' | 'planning' | null {
    const hasAnyMapping = tagMappings.income || tagMappings.expense || tagMappings.planning;

    if (hasAnyMapping) {
      // Resolve mapping tag IDs to names
      const incomeTagName = tagMappings.income ? tagIdToName[tagMappings.income] : undefined;
      const expenseTagName = tagMappings.expense ? tagIdToName[tagMappings.expense] : undefined;
      const planningTagName = tagMappings.planning ? tagIdToName[tagMappings.planning] : undefined;

      const tagGroupCols = columns.filter((c: any) => c.type === 'tag_group');
      for (const col of tagGroupCols) {
        const cellVal = data?.[col.id];
        const selectedValues: string[] = Array.isArray(cellVal) ? cellVal : cellVal ? [cellVal] : [];
        if (incomeTagName && selectedValues.includes(incomeTagName)) return 'income';
        if (expenseTagName && selectedValues.includes(expenseTagName)) return 'expense';
        if (planningTagName && selectedValues.includes(planningTagName)) return 'planning';
      }
      return null;
    }

    // Legacy fallback: check col_type for hardcoded values
    const type = data?.col_type as string;
    if (type === 'Przychód') return 'income';
    if (type === 'Wydatek') return 'expense';
    return null;
  }

  /**
   * Build a map of tag ID → tag name for the tag IDs used in tagMappings.
   */
  private async _buildTagIdToNameMap(
    familyId: string,
    tagMappings: { income?: string; expense?: string; planning?: string },
  ): Promise<Record<string, string>> {
    const tagIds = [tagMappings.income, tagMappings.expense, tagMappings.planning].filter(Boolean) as string[];
    if (tagIds.length === 0) return {};

    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, tagGroup: { familyId } },
      select: { id: true, name: true },
    });

    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.name;
    }
    return map;
  }

  /**
   * Find the first currency column to extract amounts, resolving by tag mappings context.
   */
  private _extractRecordAmount(data: any, columns: any[]): number {
    // Try col_amount first (legacy)
    const legacyAmount = this._extractAmount(data?.col_amount);
    if (legacyAmount) return legacyAmount;

    // Try first currency column
    const currencyCol = columns.find((c: any) => c.type === 'currency');
    if (currencyCol) return this._extractAmount(data?.[currencyCol.id]);

    return 0;
  }
  // #endregion

  // #region Read
  async getDashboard(familyId: string): Promise<IDashboardData> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [family, defaultTemplate, bills] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: familyId }, select: { tagMappings: true } }),
      this.prisma.template.findFirst({
        where: { familyId, isDefault: true },
        include: {
          records: {
            where: {
              createdAt: { gte: monthStart, lte: monthEnd },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.bill.findMany({
        where: { familyId, isActive: true },
        include: { payments: { orderBy: { paidAt: 'desc' } } },
        orderBy: { dueDay: 'asc' },
      }),
    ]);

    const tagMappings = (family?.tagMappings as any) ?? {};
    const columns: any[] = (defaultTemplate?.columns as any[]) ?? [];

    // Build tag ID → name map for classification
    const tagIdToName = await this._buildTagIdToNameMap(familyId, tagMappings);

    // Process template records
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const categoryMap = new Map<string, number>();
    const personMap = new Map<string, number>();
    const recentRecords: IDashboardRecentRecord[] = [];

    if (defaultTemplate) {
      for (const record of defaultTemplate.records) {
        const data = record.data as any;
        const amount = this._extractRecordAmount(data, columns);
        const classification = this._classifyRecord(data, columns, tagMappings, tagIdToName);

        if (classification === 'income') {
          monthlyIncome += amount;
        } else if (classification === 'expense') {
          monthlyExpenses += amount;

          const category = data?.col_category as string;
          const person = data?.col_person as string;

          if (category) {
            categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
          }

          if (person) {
            personMap.set(person, (personMap.get(person) ?? 0) + amount);
          }
        }
      }

      // Get last 10 records
      const last10 = defaultTemplate.records.slice(0, 10);
      for (const record of last10) {
        recentRecords.push({
          id: record.id,
          data: record.data,
          createdAt: record.createdAt,
        });
      }
    }

    // Process bills
    const upcomingBills: IDashboardBill[] = bills.map((bill: any) => {
      const billAmount = Number(bill.amount);
      const paidAmount = this._getPaidAmountForCurrentMonth(bill.payments);

      return {
        id: bill.id,
        name: bill.name,
        amount: billAmount,
        dueDay: bill.dueDay,
        nextDueDate: this._computeNextDueDate(bill.dueDay),
        isPaidThisMonth: paidAmount >= billAmount,
        paidAmount: Math.round(paidAmount * 100) / 100,
        remainingAmount: Math.round(Math.max(billAmount - paidAmount, 0) * 100) / 100,
        status: this._computeBillStatus(bill.dueDay, paidAmount, billAmount),
      };
    });

    // Build category and person breakdowns
    const expensesByCategory: IDashboardExpenseByCategory[] = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const expensesByPerson: IDashboardExpenseByPerson[] = Array.from(personMap.entries())
      .map(([person, amount]) => ({ person, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      monthlyIncome,
      monthlyExpenses,
      balance: monthlyIncome - monthlyExpenses,
      expensesByCategory,
      expensesByPerson,
      upcomingBills,
      recentRecords,
    };
  }
  // #endregion

  async getSummary(familyId: string): Promise<IDashboardSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [family, defaultTemplate, bills, fixedExpenses, savingsGoals, pendingReceiptOcrCount] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: familyId }, select: { tagMappings: true } }),
      this.prisma.template.findFirst({
        where: { familyId, isDefault: true },
        include: {
          records: {
            where: { createdAt: { gte: monthStart, lte: monthEnd } },
          },
        },
      }),
      this.prisma.bill.findMany({
        where: { familyId, isActive: true },
        include: { payments: { orderBy: { paidAt: 'desc' } } },
      }),
      this.prisma.fixedExpense.findMany({
        where: { familyId, isActive: true },
      }),
      this.prisma.savingsGoal.findMany({
        where: { familyId },
        include: { deposits: true },
      }),
      this.prisma.receipt.count({
        where: { familyId, ocrStatus: 'PENDING' as any },
      }),
    ]);

    const tagMappings = (family?.tagMappings as any) ?? {};
    const columns: any[] = (defaultTemplate?.columns as any[]) ?? [];

    // Build tag ID → name map for classification
    const tagIdToName = await this._buildTagIdToNameMap(familyId, tagMappings);

    // Calculate income and expenses from template records
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    if (defaultTemplate) {
      for (const record of defaultTemplate.records) {
        const data = record.data as any;
        const amount = this._extractRecordAmount(data, columns);
        const classification = this._classifyRecord(data, columns, tagMappings, tagIdToName);

        if (classification === 'income') {
          monthlyIncome += amount;
        } else if (classification === 'expense') {
          monthlyExpenses += amount;
        }
      }
    }

    const balance = monthlyIncome - monthlyExpenses;

    // Planned costs: unpaid bills this month + active fixed expenses + remaining savings targets
    let plannedCosts = 0;
    const upcomingPlannedPayments: IDashboardPlannedPayment[] = [];

    // Unpaid bills (remaining amount for partially/unpaid bills)
    for (const bill of bills) {
      const billAmount = Number(bill.amount);
      const paidAmount = this._getPaidAmountForCurrentMonth(bill.payments as any);

      if (paidAmount < billAmount) {
        const remaining = billAmount - paidAmount;
        plannedCosts += remaining;
        upcomingPlannedPayments.push({
          id: bill.id,
          source: 'bill',
          name: bill.name,
          amount: Math.round(remaining * 100) / 100,
          currency: (bill as any).currency ?? 'PLN',
          dueDate: this._computeNextDueDate(bill.dueDay),
        });
      }
    }

    // Fixed expenses (monthly ones not yet reflected in records)
    for (const fe of fixedExpenses) {
      const amount = Number(fe.amount);
      plannedCosts += amount;

      const dueDate = (fe as any).nextDueDate
        ? new Date((fe as any).nextDueDate)
        : this._computeNextDueDateByFrequency(
            new Date((fe as any).startDate ?? now),
            (fe as any).frequency ?? 'MONTHLY',
            (fe as any).dayOfMonth,
          );

      upcomingPlannedPayments.push({
        id: fe.id,
        source: 'fixed-expense',
        name: fe.name,
        amount: Math.round(amount * 100) / 100,
        currency: (fe as any).currency ?? 'PLN',
        dueDate,
      });
    }

    // Savings: remaining amount to reach goals (monthly contribution estimate)
    for (const goal of savingsGoals) {
      const deposited = goal.deposits.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const remaining = Number(goal.targetAmount) - deposited;

      if (remaining > 0 && goal.deadline) {
        const monthsLeft = Math.max(
          1,
          (new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30),
        );
        const estimatedMonthly = Math.round((remaining / monthsLeft) * 100) / 100;
        plannedCosts += estimatedMonthly;
        upcomingPlannedPayments.push({
          id: goal.id,
          source: 'savings',
          name: goal.name,
          amount: estimatedMonthly,
          currency: (goal as any).currency ?? 'PLN',
          dueDate: new Date(goal.deadline),
        });
      }
    }

    const top4Upcoming = upcomingPlannedPayments
      .filter((p) => p.amount > 0)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 4);

    return {
      balance,
      balanceAfterPlanned: balance - plannedCosts,
      incurredCosts: monthlyExpenses,
      plannedCosts: Math.round(plannedCosts * 100) / 100,
      upcomingPlannedPayments: top4Upcoming,
      pendingReceiptOcrCount,
    };
  }

  async getConfig(familyId: string): Promise<IDashboardConfigResponse> {
    const [family, availableCategoryFields] = await Promise.all([
      this.prisma.family.findUnique({
        where: { id: familyId },
        select: { dashboardConfig: true },
      }),
      this._getCategoryFieldOptions(familyId),
    ]);

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const normalized = this._normalizeDashboardConfig((family as any).dashboardConfig ?? {});
    const validFieldIds = new Set(availableCategoryFields.map((f) => f.id));
    const categoryFieldId = normalized.categoryFieldId && validFieldIds.has(normalized.categoryFieldId)
      ? normalized.categoryFieldId
      : null;

    return {
      categoryFieldId,
      availableCategoryFields,
    };
  }

  async updateConfig(familyId: string, input: UpdateDashboardConfigDto): Promise<IDashboardConfigResponse> {
    const availableCategoryFields = await this._getCategoryFieldOptions(familyId);
    const validFieldIds = new Set(availableCategoryFields.map((f) => f.id));
    const normalized = this._normalizeDashboardConfig(input ?? {});

    const nextConfig: IDashboardConfig = {
      categoryFieldId: normalized.categoryFieldId && validFieldIds.has(normalized.categoryFieldId)
        ? normalized.categoryFieldId
        : null,
    };

    await this.prisma.family.update({
      where: { id: familyId },
      data: { dashboardConfig: nextConfig as any },
    });

    return {
      ...nextConfig,
      availableCategoryFields,
    };
  }

  // #region Create
  // #endregion

  // #region Update
  // #endregion

  // #region Delete
  // #endregion

  // #region Misc
  // #endregion
}
