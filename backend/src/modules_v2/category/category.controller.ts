import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { CategoryContextService } from './category-context.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('v2/categories')
@UseGuards(SessionAuthGuard)
export class CategoryController {
  constructor(private readonly categoryContext: CategoryContextService) {}

  @Get()
  async getCategories(@FamilyId() familyId: string) {
    return this.categoryContext.getCategories(familyId);
  }

  @Post()
  async createCategory(@FamilyId() familyId: string, @Body() input: CreateCategoryDto) {
    return this.categoryContext.createCategory(familyId, input);
  }

  @Put(':id')
  async updateCategory(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.categoryContext.updateCategory(id, familyId, input);
  }

  @Delete(':id')
  async deleteCategory(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.categoryContext.deleteCategory(id, familyId);

    return { message: 'Category deleted successfully' };
  }
}
