import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

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
  // #endregion

  // #region Read
  async getDashboard(familyId: string): Promise<IDashboardData> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [defaultTemplate, bills] = await Promise.all([
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

    // Process template records
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const categoryMap = new Map<string, number>();
    const personMap = new Map<string, number>();
    const recentRecords: IDashboardRecentRecord[] = [];

    if (defaultTemplate) {
      for (const record of defaultTemplate.records) {
        const data = record.data as any;
        const amount = this._extractAmount(data?.col_amount);
        const type = data?.col_type as string;
        const category = data?.col_category as string;
        const person = data?.col_person as string;

        if (type === 'Przychód') {
          monthlyIncome += amount;
        } else if (type === 'Wydatek') {
          monthlyExpenses += amount;

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

    const [defaultTemplate, bills, fixedExpenses, savingsGoals] = await Promise.all([
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
    ]);

    // Calculate income and expenses from template records
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    if (defaultTemplate) {
      for (const record of defaultTemplate.records) {
        const data = record.data as any;
        const amount = this._extractAmount(data?.col_amount);
        const type = data?.col_type as string;

        if (type === 'Przychód') {
          monthlyIncome += amount;
        } else if (type === 'Wydatek') {
          monthlyExpenses += amount;
        }
      }
    }

    const balance = monthlyIncome - monthlyExpenses;

    // Planned costs: unpaid bills this month + active fixed expenses + remaining savings targets
    let plannedCosts = 0;

    // Unpaid bills (remaining amount for partially/unpaid bills)
    for (const bill of bills) {
      const billAmount = Number(bill.amount);
      const paidAmount = this._getPaidAmountForCurrentMonth(bill.payments as any);

      if (paidAmount < billAmount) {
        plannedCosts += billAmount - paidAmount;
      }
    }

    // Fixed expenses (monthly ones not yet reflected in records)
    for (const fe of fixedExpenses) {
      plannedCosts += Number(fe.amount);
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
        plannedCosts += Math.round((remaining / monthsLeft) * 100) / 100;
      }
    }

    return {
      balance,
      balanceAfterPlanned: balance - plannedCosts,
      incurredCosts: monthlyExpenses,
      plannedCosts: Math.round(plannedCosts * 100) / 100,
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
