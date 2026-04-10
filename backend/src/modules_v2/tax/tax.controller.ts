import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { TaxContextService } from './tax-context.service';
import { UpdateTaxConfigDto } from './dto/update-tax-config.dto';
import { CreateTaxEntryDto } from './dto/create-tax-entry.dto';
import { UpdateTaxEntryDto } from './dto/update-tax-entry.dto';
import { PayTaxEntryDto } from './dto/pay-tax-entry.dto';

@Controller('v2/tax')
@UseGuards(SessionAuthGuard)
export class TaxController {
  constructor(private readonly taxContext: TaxContextService) {}

  @Get('config')
  async getConfig(@FamilyId() familyId: string) {
    return this.taxContext.getTaxConfig(familyId);
  }

  @Put('config')
  async updateConfig(@FamilyId() familyId: string, @Body() input: UpdateTaxConfigDto) {
    return this.taxContext.updateTaxConfig(familyId, input);
  }

  @Get('summary')
  async getSummary(
    @FamilyId() familyId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const parsedMonth = month ? Number(month) : undefined;
    const parsedYear = year ? Number(year) : undefined;
    return this.taxContext.getMonthlyTaxSummary(familyId, parsedMonth, parsedYear);
  }

  @Get('entries')
  async getEntries(
    @FamilyId() familyId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const parsedMonth = month ? Number(month) : undefined;
    const parsedYear = year ? Number(year) : undefined;
    return this.taxContext.getOrCreateMonthlyEntries(familyId, parsedMonth, parsedYear);
  }

  @Post('entries/recalculate')
  async recalculateEntries(
    @FamilyId() familyId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const parsedMonth = month ? Number(month) : undefined;
    const parsedYear = year ? Number(year) : undefined;
    return this.taxContext.recalculateEntries(familyId, parsedMonth, parsedYear);
  }

  @Post('entries')
  async createEntry(@FamilyId() familyId: string, @Body() input: CreateTaxEntryDto) {
    return this.taxContext.createTaxEntry(familyId, input);
  }

  @Put('entries/:id')
  async updateEntry(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateTaxEntryDto,
  ) {
    return this.taxContext.updateTaxEntry(familyId, id, input);
  }

  @Post('entries/:id/pay')
  async payEntry(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: PayTaxEntryDto,
  ) {
    return this.taxContext.payTaxEntry(familyId, id, input);
  }

  @Delete('entries/:id')
  async deleteEntry(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.taxContext.deleteTaxEntry(familyId, id);
  }
}
