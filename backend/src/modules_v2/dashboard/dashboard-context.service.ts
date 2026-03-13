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

export interface IStatisticsMonth {
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  income: number;
  expenses: number;
  balance: number;
  savings: number;
  savingsRate: number;
}

export interface IStatisticsSeriesPoint {
  monthKey: string;
  monthLabel: string;
  income: number;
  expenses: number;
  balance: number;
  savings: number;
}

export interface IStatisticsCategoryTotal {
  name: string;
  amount: number;
}

export interface IStatisticsResponse {
  months: IStatisticsMonth[];
  averageIncome: number;
  averageExpenses: number;
  averageBalance: number;
  averageSavings: number;
  averageSavingsRate: number;
  medianMonthlyExpenses: number;
  incomeStdDev: number;
  expensesStdDev: number;
  balanceForecast: {
    nextMonth: number;
    inTwoMonths: number;
    inThreeMonths: number;
  };
  topGrowthCategories: Array<{
    category: string;
    currentAmount: number;
    previousAmount: number;
    delta: number;
    growthRate: number;
  }>;
  fixedVsVariable: {
    fixedAmount: number;
    variableAmount: number;
    fixedShare: number;
    variableShare: number;
  };
  savingsEffectiveness: {
    averageEffectiveness: number;
    monthly: Array<{
      monthKey: string;
      monthLabel: string;
      planned: number;
      actual: number;
      effectiveness: number;
    }>;
  };
  categoryTotals: IStatisticsCategoryTotal[];
  series: IStatisticsSeriesPoint[];
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
  private _computeNextDueDate(dueDay: number, startDate?: Date | null, endDate?: Date | null): Date {
    const now = new Date();
    const reference = startDate && startDate > now ? startDate : now;
    const currentMonth = new Date(reference.getFullYear(), reference.getMonth(), dueDay);

    if (currentMonth >= reference) {
      if (endDate && currentMonth > endDate) return endDate;
      return currentMonth;
    }

    const nextMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, dueDay);
    if (endDate && nextMonth > endDate) return endDate;
    return nextMonth;
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
    tagMappings: { income?: string; expense?: string; planning?: string; savings?: string },
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
    tagMappings: { income?: string; expense?: string; planning?: string; savings?: string },
  ): Promise<Record<string, string>> {
    const tagIds = [tagMappings.income, tagMappings.expense, tagMappings.planning, tagMappings.savings]
      .filter(Boolean) as string[];
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

  private _readTagValues(data: any, columns: any[]): string[] {
    const result: string[] = [];
    const tagGroupCols = columns.filter((c: any) => c.type === 'tag_group');
    for (const col of tagGroupCols) {
      const value = data?.[col.id];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === 'string') result.push(entry);
        }
      } else if (typeof value === 'string') {
        result.push(value);
      }
    }
    return result;
  }

  private _extractRecordDate(data: any, createdAt: Date): Date {
    const raw = data?.col_date;
    if (typeof raw === 'string') {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return createdAt;
  }

  private _monthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private _monthLabel(year: number, month: number): string {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' });
  }

  private _frequencyToMonthlyMultiplier(frequency?: string): number {
    switch (frequency) {
      case 'DAILY': return 30;
      case 'WEEKLY': return 4.33;
      case 'QUARTERLY': return 1 / 3;
      case 'YEARLY': return 1 / 12;
      case 'MONTHLY':
      default:
        return 1;
    }
  }

  private _round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private _stdDev(values: number[]): number {
    if (!values.length) return 0;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private _median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
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
        where: {
          familyId,
          isActive: true,
          paymentStartDate: { lte: monthEnd },
          OR: [{ paymentEndDate: null }, { paymentEndDate: { gte: monthStart } }],
        },
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
        nextDueDate: this._computeNextDueDate(
          bill.dueDay,
          (bill as any).paymentStartDate ? new Date((bill as any).paymentStartDate) : null,
          (bill as any).paymentEndDate ? new Date((bill as any).paymentEndDate) : null,
        ),
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
        where: {
          familyId,
          isActive: true,
          paymentStartDate: { lte: monthEnd },
          OR: [{ paymentEndDate: null }, { paymentEndDate: { gte: monthStart } }],
        },
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
          dueDate: this._computeNextDueDate(
            bill.dueDay,
            (bill as any).paymentStartDate ? new Date((bill as any).paymentStartDate) : null,
            (bill as any).paymentEndDate ? new Date((bill as any).paymentEndDate) : null,
          ),
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

  async getStatistics(familyId: string): Promise<IStatisticsResponse> {
    const [family, defaultTemplate, bills, fixedExpenses, savingsGoals] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: familyId }, select: { tagMappings: true, dashboardConfig: true } }),
      this.prisma.template.findFirst({
        where: { familyId, isDefault: true },
        include: {
          records: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.bill.findMany({
        where: { familyId, isActive: true },
        select: { amount: true, frequency: true },
      }),
      this.prisma.fixedExpense.findMany({
        where: { familyId, isActive: true },
        select: { amount: true, frequency: true },
      }),
      this.prisma.savingsGoal.findMany({
        where: { familyId },
        include: { deposits: true },
      }),
    ]);

    if (!defaultTemplate) {
      return {
        months: [],
        averageIncome: 0,
        averageExpenses: 0,
        averageBalance: 0,
        averageSavings: 0,
        averageSavingsRate: 0,
        medianMonthlyExpenses: 0,
        incomeStdDev: 0,
        expensesStdDev: 0,
        balanceForecast: { nextMonth: 0, inTwoMonths: 0, inThreeMonths: 0 },
        topGrowthCategories: [],
        fixedVsVariable: { fixedAmount: 0, variableAmount: 0, fixedShare: 0, variableShare: 0 },
        savingsEffectiveness: { averageEffectiveness: 0, monthly: [] },
        categoryTotals: [],
        series: [],
      };
    }

    const tagMappings = ((family?.tagMappings as any) ?? {}) as {
      income?: string;
      expense?: string;
      planning?: string;
      savings?: string;
    };
    const dashboardConfig = this._normalizeDashboardConfig((family?.dashboardConfig as any) ?? {});
    const columns: any[] = Array.isArray(defaultTemplate.columns) ? (defaultTemplate.columns as any[]) : [];
    const tagIdToName = await this._buildTagIdToNameMap(familyId, tagMappings);
    const savingsTagName = tagMappings.savings ? tagIdToName[tagMappings.savings] : undefined;
    const categoryFieldId = dashboardConfig.categoryFieldId && columns.some((c: any) => c?.id === dashboardConfig.categoryFieldId)
      ? dashboardConfig.categoryFieldId
      : null;

    const monthly = new Map<string, {
      year: number;
      month: number;
      income: number;
      expenses: number;
      savings: number;
    }>();
    const categoryTotals = new Map<string, number>();
    const categoryByMonth = new Map<string, Map<string, number>>();

    for (const record of defaultTemplate.records) {
      const data = (record as any).data ?? {};
      const recordDate = this._extractRecordDate(data, (record as any).createdAt);
      const monthKey = this._monthKey(recordDate);
      const bucket = monthly.get(monthKey) ?? {
        year: recordDate.getFullYear(),
        month: recordDate.getMonth() + 1,
        income: 0,
        expenses: 0,
        savings: 0,
      };

      const amount = this._extractRecordAmount(data, columns);
      const classification = this._classifyRecord(data, columns, tagMappings, tagIdToName);
      const tagValues = this._readTagValues(data, columns);

      if (classification === 'income') {
        bucket.income += amount;
      } else if (classification === 'expense') {
        bucket.expenses += amount;

        if (savingsTagName && tagValues.includes(savingsTagName)) {
          bucket.savings += amount;
        }

        const categoryName = categoryFieldId && data?.[categoryFieldId]
          ? (Array.isArray(data[categoryFieldId]) ? data[categoryFieldId][0] : data[categoryFieldId])
          : (data?.col_category ?? 'Bez kategorii');

        if (typeof categoryName === 'string' && categoryName.trim()) {
          categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + amount);
          const monthCategories = categoryByMonth.get(monthKey) ?? new Map<string, number>();
          monthCategories.set(categoryName, (monthCategories.get(categoryName) ?? 0) + amount);
          categoryByMonth.set(monthKey, monthCategories);
        }
      }

      monthly.set(monthKey, bucket);
    }

    const months = Array.from(monthly.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, bucket]) => {
        const balance = bucket.income - bucket.expenses;
        const savingsRate = bucket.income > 0 ? (bucket.savings / bucket.income) * 100 : 0;
        return {
          monthKey,
          monthLabel: this._monthLabel(bucket.year, bucket.month),
          year: bucket.year,
          month: bucket.month,
          income: Math.round(bucket.income * 100) / 100,
          expenses: Math.round(bucket.expenses * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          savings: Math.round(bucket.savings * 100) / 100,
          savingsRate: Math.round(savingsRate * 10) / 10,
        };
      });

    const monthCount = months.length || 1;
    const sumIncome = months.reduce((sum, month) => sum + month.income, 0);
    const sumExpenses = months.reduce((sum, month) => sum + month.expenses, 0);
    const sumBalance = months.reduce((sum, month) => sum + month.balance, 0);
    const sumSavings = months.reduce((sum, month) => sum + month.savings, 0);
    const medianMonthlyExpenses = this._median(months.map((month) => month.expenses));
    const incomeStdDev = this._stdDev(months.map((month) => month.income));
    const expensesStdDev = this._stdDev(months.map((month) => month.expenses));

    const sortedChronological = [...months].reverse();
    const rollingBalances = sortedChronological.map((month) => month.balance);
    const seedWindow = rollingBalances.slice(Math.max(0, rollingBalances.length - 3));
    const window = seedWindow.length > 0 ? [...seedWindow] : [0, 0, 0];
    const forecast: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const avg = window.reduce((sum, value) => sum + value, 0) / window.length;
      forecast.push(this._round2(avg));
      window.push(avg);
      if (window.length > 3) window.shift();
    }

    const monthlyFixedFromBills = bills.reduce((sum, bill) => {
      return sum + (Number((bill as any).amount ?? 0) * this._frequencyToMonthlyMultiplier((bill as any).frequency));
    }, 0);
    const monthlyFixedFromFixedExpenses = fixedExpenses.reduce((sum, fixed) => {
      return sum + (Number((fixed as any).amount ?? 0) * this._frequencyToMonthlyMultiplier((fixed as any).frequency));
    }, 0);
    const fixedAmount = this._round2(monthlyFixedFromBills + monthlyFixedFromFixedExpenses);
    const avgExpenses = sumExpenses / monthCount;
    const variableAmount = this._round2(Math.max(avgExpenses - fixedAmount, 0));
    const fixedVariableTotal = Math.max(fixedAmount + variableAmount, 0.0001);
    const fixedShare = this._round2((fixedAmount / fixedVariableTotal) * 100);
    const variableShare = this._round2((variableAmount / fixedVariableTotal) * 100);

    const monthKeysDesc = months.map((month) => month.monthKey);
    const savingsEffectivenessMonthly = monthKeysDesc.map((monthKey) => {
      const monthData = months.find((item) => item.monthKey === monthKey);
      if (!monthData) {
        return { monthKey, monthLabel: monthKey, planned: 0, actual: 0, effectiveness: 0 };
      }

      const monthStart = new Date(monthData.year, monthData.month - 1, 1);
      const monthEnd = new Date(monthData.year, monthData.month, 0, 23, 59, 59);
      const actual = this._round2(monthData.savings);

      let planned = 0;
      for (const goal of savingsGoals) {
        if (!goal.deadline) continue;
        const deadline = new Date(goal.deadline);
        if (deadline < monthStart) continue;

        const depositedToDate = goal.deposits
          .filter((deposit) => new Date((deposit as any).date) <= monthEnd)
          .reduce((sum, deposit) => sum + Number((deposit as any).amount ?? 0), 0);

        const remaining = Math.max(0, Number((goal as any).targetAmount ?? 0) - depositedToDate);
        const monthsLeft = Math.max(
          1,
          ((deadline.getFullYear() - monthStart.getFullYear()) * 12)
          + (deadline.getMonth() - monthStart.getMonth())
          + 1,
        );

        planned += remaining / monthsLeft;
      }

      planned = this._round2(planned);
      const effectiveness = planned > 0
        ? this._round2((actual / planned) * 100)
        : (actual > 0 ? 100 : 0);

      return {
        monthKey,
        monthLabel: monthData.monthLabel,
        planned,
        actual,
        effectiveness,
      };
    });

    const avgSavingsEffectiveness = savingsEffectivenessMonthly.length > 0
      ? this._round2(
          savingsEffectivenessMonthly.reduce((sum, item) => sum + item.effectiveness, 0)
          / savingsEffectivenessMonthly.length,
        )
      : 0;

    const topGrowthCategories = (() => {
      if (monthKeysDesc.length < 2) return [] as Array<{
        category: string;
        currentAmount: number;
        previousAmount: number;
        delta: number;
        growthRate: number;
      }>;

      const latestKey = monthKeysDesc[0];
      const previousKey = monthKeysDesc[1];
      const latest = categoryByMonth.get(latestKey) ?? new Map<string, number>();
      const previous = categoryByMonth.get(previousKey) ?? new Map<string, number>();

      const rows: Array<{
        category: string;
        currentAmount: number;
        previousAmount: number;
        delta: number;
        growthRate: number;
      }> = [];

      for (const [category, currentAmountRaw] of latest.entries()) {
        const currentAmount = Number(currentAmountRaw ?? 0);
        const previousAmount = Number(previous.get(category) ?? 0);
        const delta = currentAmount - previousAmount;
        const growthRate = previousAmount > 0 ? (delta / previousAmount) * 100 : (currentAmount > 0 ? 100 : 0);
        rows.push({
          category,
          currentAmount: this._round2(currentAmount),
          previousAmount: this._round2(previousAmount),
          delta: this._round2(delta),
          growthRate: this._round2(growthRate),
        });
      }

      return rows
        .filter((row) => row.delta > 0)
        .sort((a, b) => b.growthRate - a.growthRate)
        .slice(0, 5);
    })();

    return {
      months,
      averageIncome: this._round2(sumIncome / monthCount),
      averageExpenses: this._round2(sumExpenses / monthCount),
      averageBalance: this._round2(sumBalance / monthCount),
      averageSavings: this._round2(sumSavings / monthCount),
      averageSavingsRate: sumIncome > 0 ? Math.round((sumSavings / sumIncome) * 1000) / 10 : 0,
      medianMonthlyExpenses: this._round2(medianMonthlyExpenses),
      incomeStdDev: this._round2(incomeStdDev),
      expensesStdDev: this._round2(expensesStdDev),
      balanceForecast: {
        nextMonth: forecast[0] ?? 0,
        inTwoMonths: forecast[1] ?? 0,
        inThreeMonths: forecast[2] ?? 0,
      },
      topGrowthCategories,
      fixedVsVariable: {
        fixedAmount,
        variableAmount,
        fixedShare,
        variableShare,
      },
      savingsEffectiveness: {
        averageEffectiveness: avgSavingsEffectiveness,
        monthly: savingsEffectivenessMonthly,
      },
      categoryTotals: Array.from(categoryTotals.entries())
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      series: [...months]
        .reverse()
        .map((month) => ({
          monthKey: month.monthKey,
          monthLabel: month.monthLabel,
          income: month.income,
          expenses: month.expenses,
          balance: month.balance,
          savings: month.savings,
        })),
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
