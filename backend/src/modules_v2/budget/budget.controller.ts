import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { BudgetContextService } from './budget-context.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Controller('v2/budgets')
@UseGuards(SessionAuthGuard)
export class BudgetController {
  constructor(private readonly budgetContext: BudgetContextService) {}

  @Get()
  async getBudgets(
    @FamilyId() familyId: string,
    @Query('year') year?: string,
  ) {
    return this.budgetContext.getBudgets(familyId, year ? parseInt(year) : undefined);
  }

  @Get('current')
  async getCurrentBudget(@FamilyId() familyId: string) {
    return this.budgetContext.getCurrentBudget(familyId);
  }

  @Get(':id')
  async getBudget(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.budgetContext.getBudget(id, familyId);
  }

  @Post()
  async createBudget(@FamilyId() familyId: string, @Body() input: CreateBudgetDto) {
    return this.budgetContext.createBudget(familyId, input);
  }

  @Put(':id')
  async updateBudget(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateBudgetDto,
  ) {
    return this.budgetContext.updateBudget(id, familyId, input);
  }

  @Delete(':id')
  async deleteBudget(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.budgetContext.deleteBudget(id, familyId);
    return { message: 'Budget deleted successfully' };
  }
}
