import { Injectable, NotFoundException } from '@nestjs/common';
import { FixedExpenseActionsService } from './fixed-expense-actions.service';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';
import { UpdateFixedExpenseDto } from './dto/update-fixed-expense.dto';

@Injectable()
export class FixedExpenseContextService {
  constructor(private readonly fixedExpenseActions: FixedExpenseActionsService) {}

  // #region Private
  // #endregion

  // #region Create
  async createFixedExpense(familyId: string, input: CreateFixedExpenseDto) {
    const expense = await this.fixedExpenseActions.createFixedExpense({
      familyId,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      categoryId: input.categoryId,
      personId: input.personId,
      notes: input.notes,
    });

    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }
  // #endregion

  // #region Read
  async getFixedExpenses(familyId: string) {
    const expenses = await this.fixedExpenseActions.findFixedExpensesByFamily(familyId);

    return expenses.map((e: any) => ({
      ...e,
      amount: Number(e.amount),
    }));
  }
  // #endregion

  // #region Update
  async updateFixedExpense(id: string, familyId: string, input: UpdateFixedExpenseDto) {
    const existing = await this.fixedExpenseActions.findFixedExpenseById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Fixed expense not found');
    }

    const expense = await this.fixedExpenseActions.updateFixedExpense(id, familyId, {
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      categoryId: input.categoryId,
      personId: input.personId,
      notes: input.notes,
      isActive: input.isActive,
    });

    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }
  // #endregion

  // #region Delete
  async deleteFixedExpense(id: string, familyId: string) {
    const existing = await this.fixedExpenseActions.findFixedExpenseById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Fixed expense not found');
    }

    await this.fixedExpenseActions.deleteFixedExpense(id, familyId);

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
