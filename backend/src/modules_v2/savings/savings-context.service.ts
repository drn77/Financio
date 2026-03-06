import { Injectable, NotFoundException } from '@nestjs/common';
import { SavingsActionsService } from './savings-actions.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Injectable()
export class SavingsContextService {
  constructor(private readonly savingsActions: SavingsActionsService) {}

  // #region Private
  private _computeGoalProgress(deposits: { amount: any }[], targetAmount: number) {
    const currentAmount = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
    const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

    return { currentAmount, progress: Math.round(progress * 100) / 100 };
  }
  // #endregion

  // #region Create
  async createGoal(familyId: string, input: CreateGoalDto) {
    const goal = await this.savingsActions.createGoal({
      familyId,
      name: input.name,
      targetAmount: input.targetAmount,
      currency: input.currency,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      icon: input.icon,
      color: input.color,
    });

    return {
      ...goal,
      targetAmount: Number(goal.targetAmount),
      deposits: goal.deposits.map((d: any) => ({
        ...d,
        amount: Number(d.amount),
      })),
      currentAmount: 0,
      progress: 0,
    };
  }

  async addDeposit(goalId: string, familyId: string, userId: string, input: CreateDepositDto) {
    const goal = await this.savingsActions.findGoalById(goalId, familyId);

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const deposit = await this.savingsActions.createDeposit({
      goalId,
      userId,
      amount: input.amount,
      date: new Date(input.date),
      notes: input.notes,
    });

    return {
      ...deposit,
      amount: Number(deposit.amount),
    };
  }
  // #endregion

  // #region Read
  async getGoals(familyId: string) {
    const goals = await this.savingsActions.findGoalsByFamily(familyId);

    return goals.map((goal: any) => {
      const targetAmount = Number(goal.targetAmount);
      const { currentAmount, progress } = this._computeGoalProgress(goal.deposits, targetAmount);

      return {
        ...goal,
        targetAmount,
        deposits: goal.deposits.map((d: any) => ({
          ...d,
          amount: Number(d.amount),
        })),
        currentAmount,
        progress,
      };
    });
  }

  async getDeposits(goalId: string, familyId: string) {
    const goal = await this.savingsActions.findGoalById(goalId, familyId);

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const deposits = await this.savingsActions.findDepositsByGoal(goalId);

    return deposits.map((d: any) => ({
      ...d,
      amount: Number(d.amount),
    }));
  }
  // #endregion

  // #region Update
  async updateGoal(id: string, familyId: string, input: UpdateGoalDto) {
    const existing = await this.savingsActions.findGoalById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    const goal = await this.savingsActions.updateGoal(id, familyId, {
      name: input.name,
      targetAmount: input.targetAmount,
      currency: input.currency,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      icon: input.icon,
      color: input.color,
    });

    const targetAmount = Number(goal.targetAmount);
    const { currentAmount, progress } = this._computeGoalProgress(goal.deposits, targetAmount);

    return {
      ...goal,
      targetAmount,
      deposits: goal.deposits.map((d: any) => ({
        ...d,
        amount: Number(d.amount),
      })),
      currentAmount,
      progress,
    };
  }
  // #endregion

  // #region Delete
  async deleteGoal(id: string, familyId: string) {
    const existing = await this.savingsActions.findGoalById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    await this.savingsActions.deleteGoal(id, familyId);

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
