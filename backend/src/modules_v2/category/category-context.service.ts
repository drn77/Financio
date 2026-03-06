import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryActionsService } from './category-actions.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryContextService {
  constructor(private readonly categoryActions: CategoryActionsService) {}

  // #region Private
  // #endregion

  // #region Create
  async createCategory(familyId: string, input: CreateCategoryDto) {
    return this.categoryActions.createCategory({
      familyId,
      name: input.name,
      color: input.color,
      icon: input.icon,
      sortOrder: input.sortOrder,
    });
  }
  // #endregion

  // #region Read
  async getCategories(familyId: string) {
    return this.categoryActions.findCategoriesByFamily(familyId);
  }
  // #endregion

  // #region Update
  async updateCategory(id: string, familyId: string, input: UpdateCategoryDto) {
    const existing = await this.categoryActions.findCategoryById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    return this.categoryActions.updateCategory(id, familyId, {
      name: input.name,
      color: input.color,
      icon: input.icon,
      sortOrder: input.sortOrder,
    });
  }
  // #endregion

  // #region Delete
  async deleteCategory(id: string, familyId: string) {
    const existing = await this.categoryActions.findCategoryById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    await this.categoryActions.deleteCategory(id, familyId);

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
