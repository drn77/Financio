import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { FixedExpenseContextService } from './fixed-expense-context.service';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';
import { UpdateFixedExpenseDto } from './dto/update-fixed-expense.dto';

@Controller('v2/fixed-expenses')
@UseGuards(SessionAuthGuard)
export class FixedExpenseController {
  constructor(private readonly fixedExpenseContext: FixedExpenseContextService) {}

  @Get()
  async getFixedExpenses(@FamilyId() familyId: string) {
    return this.fixedExpenseContext.getFixedExpenses(familyId);
  }

  @Post()
  async createFixedExpense(@FamilyId() familyId: string, @Body() input: CreateFixedExpenseDto) {
    return this.fixedExpenseContext.createFixedExpense(familyId, input);
  }

  @Put(':id')
  async updateFixedExpense(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateFixedExpenseDto,
  ) {
    return this.fixedExpenseContext.updateFixedExpense(id, familyId, input);
  }

  @Delete(':id')
  async deleteFixedExpense(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.fixedExpenseContext.deleteFixedExpense(id, familyId);

    return { message: 'Fixed expense deleted successfully' };
  }
}
