import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SavingsActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private
  // #endregion

  // #region Create
  async createGoal(input: {
    familyId: string;
    name: string;
    targetAmount: number;
    currency?: string;
    deadline?: Date;
    icon?: string;
    color?: string;
  }) {
    return this.prisma.savingsGoal.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
        targetAmount: input.targetAmount,
        currency: input.currency,
        deadline: input.deadline,
        icon: input.icon,
        color: input.color,
      },
      include: { deposits: true },
    });
  }

  async createDeposit(input: {
    goalId: string;
    userId: string;
    amount: number;
    date: Date;
    notes?: string;
  }) {
    return this.prisma.savingsDeposit.create({
      data: {
        goal: { connect: { id: input.goalId } },
        user: { connect: { id: input.userId } },
        amount: input.amount,
        date: input.date,
        notes: input.notes,
      },
    });
  }
  // #endregion

  // #region Read
  async findGoalsByFamily(familyId: string) {
    return this.prisma.savingsGoal.findMany({
      where: { familyId },
      include: { deposits: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findGoalById(id: string, familyId: string) {
    return this.prisma.savingsGoal.findFirst({
      where: { id, familyId },
      include: { deposits: { orderBy: { date: 'desc' } } },
    });
  }

  async findDepositsByGoal(goalId: string) {
    return this.prisma.savingsDeposit.findMany({
      where: { goalId },
      orderBy: { date: 'desc' },
    });
  }
  // #endregion

  // #region Update
  async updateGoal(id: string, familyId: string, input: {
    name?: string;
    targetAmount?: number;
    currency?: string;
    deadline?: Date;
    icon?: string;
    color?: string;
  }) {
    const data: any = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.targetAmount !== undefined) data.targetAmount = input.targetAmount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.deadline !== undefined) data.deadline = input.deadline;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.color !== undefined) data.color = input.color;

    return this.prisma.savingsGoal.update({
      where: { id, familyId },
      data,
      include: { deposits: { orderBy: { date: 'desc' } } },
    });
  }
  // #endregion

  // #region Delete
  async deleteGoal(id: string, familyId: string) {
    return this.prisma.savingsGoal.delete({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Misc
  // #endregion
}
