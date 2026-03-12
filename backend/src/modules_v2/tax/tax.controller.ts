import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { TaxContextService } from './tax-context.service';
import { UpdateTaxConfigDto } from './dto/update-tax-config.dto';

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
}
