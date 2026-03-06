import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetActionsService } from './budget-actions.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetContextService {
  constructor(
    private readonly budgetActions: BudgetActionsService,
    private readonly prisma: PrismaService,
  ) {}

  // #region Private
  private async _enrichBudget(budget: any, familyId: string) {
    const monthStart = new Date(budget.year, budget.month - 1, 1);
    const monthEnd = new Date(budget.year, budget.month, 0, 23, 59, 59);

    // Get receipts for this month to compute spent amounts
    const receipts = await this.prisma.receipt.findMany({
      where: {
        familyId,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { categoryId: true, amount: true },
    });

    const spentByCategory = new Map<string, number>();
    let totalSpent = 0;

    for (const r of receipts) {
      const amount = Number(r.amount);
      totalSpent += amount;
      if (r.categoryId) {
        spentByCategory.set(r.categoryId, (spentByCategory.get(r.categoryId) ?? 0) + amount);
      }
    }

    // Get category names
    const categoryIds = budget.categories.map((c: any) => c.categoryId);
    const categories = categoryIds.length > 0
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, color: true },
        })
      : [];
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));

    const totalLimit = budget.categories.reduce((sum: number, c: any) => sum + Number(c.limitAmount), 0);

    return {
      id: budget.id,
      familyId: budget.familyId,
      name: budget.name,
      month: budget.month,
      year: budget.year,
      totalLimit: Math.round(totalLimit * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      categories: budget.categories.map((c: any) => {
        const cat = categoryMap.get(c.categoryId);
        const spentAmount = spentByCategory.get(c.categoryId) ?? 0;
        const limitAmount = Number(c.limitAmount);
        return {
          id: c.id,
          budgetId: c.budgetId,
          categoryId: c.categoryId,
          categoryName: cat?.name ?? 'Nieznana',
          categoryColor: cat?.color ?? '#666',
          limitAmount: Math.round(limitAmount * 100) / 100,
          spentAmount: Math.round(spentAmount * 100) / 100,
          progress: limitAmount > 0 ? Math.round((spentAmount / limitAmount) * 100) : 0,
        };
      }),
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
  // #endregion

  // #region Create
  async createBudget(familyId: string, input: CreateBudgetDto) {
    const budget = await this.budgetActions.createBudget({
      familyId,
      name: input.name,
      month: input.month,
      year: input.year,
      categories: input.categories,
    });

    return this._enrichBudget(budget, familyId);
  }
  // #endregion

  // #region Read
  async getBudgets(familyId: string, year?: number) {
    const budgets = await this.budgetActions.findBudgetsByFamily(familyId, year);
    return Promise.all(budgets.map((b) => this._enrichBudget(b, familyId)));
  }

  async getBudget(id: string, familyId: string) {
    const budget = await this.budgetActions.findBudgetById(id, familyId);
    if (!budget) throw new NotFoundException('Budget not found');
    return this._enrichBudget(budget, familyId);
  }

  async getCurrentBudget(familyId: string) {
    const now = new Date();
    const budget = await this.budgetActions.findBudgetByMonth(familyId, now.getMonth() + 1, now.getFullYear());
    if (!budget) return null;
    return this._enrichBudget(budget, familyId);
  }
  // #endregion

  // #region Update
  async updateBudget(id: string, familyId: string, input: UpdateBudgetDto) {
    const existing = await this.budgetActions.findBudgetById(id, familyId);
    if (!existing) throw new NotFoundException('Budget not found');

    const budget = await this.budgetActions.updateBudget(id, familyId, {
      name: input.name,
      month: input.month,
      year: input.year,
      categories: input.categories,
    });

    return this._enrichBudget(budget, familyId);
  }
  // #endregion

  // #region Delete
  async deleteBudget(id: string, familyId: string) {
    const existing = await this.budgetActions.findBudgetById(id, familyId);
    if (!existing) throw new NotFoundException('Budget not found');

    await this.budgetActions.deleteBudget(id, familyId);
  }
  // #endregion
}
