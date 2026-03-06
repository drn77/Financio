import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class BillActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private
  private readonly _billInclude = {
    payments: { orderBy: { paidAt: 'desc' as const } },
    tags: { include: { tag: { include: { tagGroup: true } } } },
  };
  // #endregion

  // #region Create
  async createBill(input: {
    familyId: string;
    name: string;
    amount: number;
    currency?: string;
    dueDay: number;
    frequency?: string;
    categoryId?: string;
    notes?: string;
    paymentType?: string;
    autoCreateExpense?: boolean;
    reminderDays?: number;
    budgetLimit?: number;
    tagIds?: string[];
  }) {
    return this.prisma.bill.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
        amount: input.amount,
        currency: input.currency,
        dueDay: input.dueDay,
        frequency: (input.frequency as any) ?? undefined,
        categoryId: input.categoryId,
        notes: input.notes,
        paymentType: (input.paymentType as any) ?? undefined,
        autoCreateExpense: input.autoCreateExpense,
        reminderDays: input.reminderDays,
        budgetLimit: input.budgetLimit,
        tags: input.tagIds?.length
          ? { create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : undefined,
      },
      include: this._billInclude,
    });
  }

  async createBillPayment(input: {
    billId: string;
    amount: number;
    dueDate: Date;
    notes?: string;
  }) {
    return this.prisma.billPayment.create({
      data: {
        bill: { connect: { id: input.billId } },
        amount: input.amount,
        dueDate: input.dueDate,
        notes: input.notes,
      },
    });
  }
  // #endregion

  // #region Read
  async findBillsByFamily(familyId: string, activeOnly?: boolean) {
    const where: any = { familyId };

    if (activeOnly !== undefined) {
      where.isActive = activeOnly;
    }

    return this.prisma.bill.findMany({
      where,
      include: this._billInclude,
      orderBy: { dueDay: 'asc' },
    });
  }

  async findBillById(id: string, familyId: string) {
    return this.prisma.bill.findFirst({
      where: { id, familyId },
      include: this._billInclude,
    });
  }

  async findBillPayments(billId: string, limit?: number) {
    return this.prisma.billPayment.findMany({
      where: { billId },
      orderBy: { paidAt: 'desc' },
      take: limit,
    });
  }

  async findBillsByTagId(tagId: string, familyId: string) {
    return this.prisma.bill.findMany({
      where: {
        familyId,
        tags: { some: { tagId } },
      },
      include: this._billInclude,
    });
  }
  // #endregion

  // #region Update
  async updateBill(id: string, familyId: string, input: {
    name?: string;
    amount?: number;
    currency?: string;
    dueDay?: number;
    frequency?: string;
    categoryId?: string;
    notes?: string;
    isActive?: boolean;
    paymentType?: string;
    autoCreateExpense?: boolean;
    reminderDays?: number;
    budgetLimit?: number;
  }) {
    const data: any = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.dueDay !== undefined) data.dueDay = input.dueDay;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.paymentType !== undefined) data.paymentType = input.paymentType;
    if (input.autoCreateExpense !== undefined) data.autoCreateExpense = input.autoCreateExpense;
    if (input.reminderDays !== undefined) data.reminderDays = input.reminderDays;
    if (input.budgetLimit !== undefined) data.budgetLimit = input.budgetLimit;

    return this.prisma.bill.update({
      where: { id, familyId },
      data,
      include: this._billInclude,
    });
  }

  async replaceBillTags(billId: string, tagIds: string[]) {
    await this.prisma.billTag.deleteMany({ where: { billId } });

    if (tagIds.length === 0) return;

    await this.prisma.billTag.createMany({
      data: tagIds.map((tagId) => ({ billId, tagId })),
    });
  }
  // #endregion

  // #region Delete
  async deleteBill(id: string, familyId: string) {
    return this.prisma.bill.delete({
      where: { id, familyId },
    });
  }

  async deleteBillPayment(paymentId: string, billId: string) {
    return this.prisma.billPayment.delete({
      where: { id: paymentId, billId },
    });
  }
  // #endregion

  // #region Misc
  async getBillStats(familyId: string) {
    const bills = await this.prisma.bill.findMany({
      where: { familyId, isActive: true },
      include: { payments: true },
    });

    const totalMonthly = bills.reduce((sum, bill) => {
      const amount = Number(bill.amount);
      switch (bill.frequency) {
        case 'DAILY': return sum + amount * 30;
        case 'WEEKLY': return sum + amount * 4.33;
        case 'MONTHLY': return sum + amount;
        case 'QUARTERLY': return sum + amount / 3;
        case 'YEARLY': return sum + amount / 12;
        default: return sum + amount;
      }
    }, 0);

    return {
      totalBills: bills.length,
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      activeBills: bills.filter((b) => b.isActive).length,
    };
  }
  // #endregion
}
