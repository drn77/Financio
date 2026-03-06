import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class CategoryActionsService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Private
  // #endregion

  // #region Create
  async createCategory(input: {
    familyId: string;
    name: string;
    color?: string;
    icon?: string;
    sortOrder?: number;
  }) {
    return this.prisma.category.create({
      data: {
        family: { connect: { id: input.familyId } },
        name: input.name,
        color: input.color,
        icon: input.icon,
        sortOrder: input.sortOrder,
      },
    });
  }
  // #endregion

  // #region Read
  async findCategoriesByFamily(familyId: string) {
    return this.prisma.category.findMany({
      where: { familyId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findCategoryById(id: string, familyId: string) {
    return this.prisma.category.findFirst({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Update
  async updateCategory(id: string, familyId: string, input: {
    name?: string;
    color?: string;
    icon?: string;
    sortOrder?: number;
  }) {
    const data: any = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    return this.prisma.category.update({
      where: { id, familyId },
      data,
    });
  }
  // #endregion

  // #region Delete
  async deleteCategory(id: string, familyId: string) {
    return this.prisma.category.delete({
      where: { id, familyId },
    });
  }
  // #endregion

  // #region Misc
  // #endregion
}
