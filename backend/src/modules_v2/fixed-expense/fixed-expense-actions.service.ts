import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class FixedExpenseActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private
  // #endregion

  // #region Create
  async createFixedExpense(input: {
    familyId: string;
    name: string;
    amount: number;
    currency?: string;
    frequency?: string;
    dayOfMonth?: number;
    startDate: Date;
    endDate?: Date;
    nextDueDate?: Date;
    categoryId?: string;
    personId?: string;
    paymentTagId?: string;
    paymentTemplateData?: Record<string, unknown>;
    notes?: string;
  }) {
    return this.prisma.fixedExpense.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
        amount: input.amount,
        currency: input.currency,
        frequency: (input.frequency as any) ?? undefined,
        dayOfMonth: input.dayOfMonth,
        startDate: input.startDate,
        endDate: input.endDate,
        nextDueDate: input.nextDueDate,
        categoryId: input.categoryId,
        personId: input.personId,
        paymentTagId: input.paymentTagId,
        paymentTemplateData: input.paymentTemplateData as any,
        notes: input.notes,
      },
    });
  }
  // #endregion

  // #region Read
  async findFixedExpensesByFamily(familyId: string) {
    return this.prisma.fixedExpense.findMany({
      where: { familyId },
      orderBy: { name: 'asc' },
    });
  }

  async findFixedExpenseById(id: string, familyId: string) {
    return this.prisma.fixedExpense.findFirst({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Update
  async updateFixedExpense(id: string, familyId: string, input: {
    name?: string;
    amount?: number;
    currency?: string;
    frequency?: string;
    dayOfMonth?: number;
    startDate?: Date;
    endDate?: Date;
    nextDueDate?: Date;
    lastPaidAt?: Date;
    categoryId?: string;
    personId?: string;
    paymentTagId?: string;
    paymentTemplateData?: Record<string, unknown>;
    notes?: string;
    isActive?: boolean;
  }) {
    const data: any = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.dayOfMonth !== undefined) data.dayOfMonth = input.dayOfMonth;
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.nextDueDate !== undefined) data.nextDueDate = input.nextDueDate;
    if (input.lastPaidAt !== undefined) data.lastPaidAt = input.lastPaidAt;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.personId !== undefined) data.personId = input.personId;
    if (input.paymentTagId !== undefined) data.paymentTagId = input.paymentTagId;
    if (input.paymentTemplateData !== undefined) data.paymentTemplateData = input.paymentTemplateData as any;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.fixedExpense.update({
      where: { id, familyId },
      data,
    });
  }
  // #endregion

  // #region Delete
  async deleteFixedExpense(id: string, familyId: string) {
    return this.prisma.fixedExpense.delete({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Misc
  // #endregion
}
