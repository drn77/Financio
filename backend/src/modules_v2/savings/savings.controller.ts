import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId, UserId } from '../../shared/decorators/session.decorator';
import { SavingsContextService } from './savings-context.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Controller('v2/savings')
@UseGuards(SessionAuthGuard)
export class SavingsController {
  constructor(private readonly savingsContext: SavingsContextService) {}

  @Get('goals')
  async getGoals(@FamilyId() familyId: string) {
    return this.savingsContext.getGoals(familyId);
  }

  @Post('goals')
  async createGoal(@FamilyId() familyId: string, @Body() input: CreateGoalDto) {
    return this.savingsContext.createGoal(familyId, input);
  }

  @Put('goals/:id')
  async updateGoal(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateGoalDto,
  ) {
    return this.savingsContext.updateGoal(id, familyId, input);
  }

  @Delete('goals/:id')
  async deleteGoal(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.savingsContext.deleteGoal(id, familyId);

    return { message: 'Savings goal deleted successfully' };
  }

  @Get('goals/:id/deposits')
  async getDeposits(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.savingsContext.getDeposits(id, familyId);
  }

  @Post('goals/:id/deposits')
  async addDeposit(
    @FamilyId() familyId: string,
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() input: CreateDepositDto,
  ) {
    return this.savingsContext.addDeposit(id, familyId, userId, input);
  }
}
