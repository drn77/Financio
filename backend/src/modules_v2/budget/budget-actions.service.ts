import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class BudgetActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Create
  async createBudget(input: {
    familyId: string;
    name: string;
    month: number;
    year: number;
    categories?: { categoryId: string; limitAmount: number }[];
  }) {
    return this.prisma.budget.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
        month: input.month,
        year: input.year,
        categories: input.categories && input.categories.length > 0
          ? { create: input.categories.map((c) => ({ categoryId: c.categoryId, limitAmount: c.limitAmount })) }
          : undefined,
      },
      include: { categories: true },
    });
  }
  // #endregion

  // #region Read
  async findBudgetsByFamily(familyId: string, year?: number) {
    return this.prisma.budget.findMany({
      where: { familyId, ...(year ? { year } : {}) },
      include: { categories: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async findBudgetById(id: string, familyId: string) {
    return this.prisma.budget.findFirst({
      where: { id, familyId },
      include: { categories: true },
    });
  }

  async findBudgetByMonth(familyId: string, month: number, year: number) {
    return this.prisma.budget.findFirst({
      where: { familyId, month, year },
      include: { categories: true },
    });
  }
  // #endregion

  // #region Update
  async updateBudget(id: string, familyId: string, input: {
    name?: string;
    month?: number;
    year?: number;
    categories?: { categoryId: string; limitAmount: number }[];
  }) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.month !== undefined) data.month = input.month;
    if (input.year !== undefined) data.year = input.year;

    if (input.categories !== undefined) {
      await this.prisma.budgetCategory.deleteMany({ where: { budgetId: id } });
      if (input.categories.length > 0) {
        data.categories = {
          create: input.categories.map((c) => ({ categoryId: c.categoryId, limitAmount: c.limitAmount })),
        };
      }
    }

    return this.prisma.budget.update({
      where: { id, familyId },
      data,
      include: { categories: true },
    });
  }
  // #endregion

  // #region Delete
  async deleteBudget(id: string, familyId: string) {
    return this.prisma.budget.delete({
      where: { id, familyId },
    });
  }
  // #endregion
}
