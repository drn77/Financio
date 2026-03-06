import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { BillContextService } from './bill-context.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PayBillDto } from './dto/pay-bill.dto';

@Controller('v2/bills')
@UseGuards(SessionAuthGuard)
export class BillController {
  constructor(private readonly billContext: BillContextService) {}

  @Get()
  async getBills(
    @FamilyId() familyId: string,
    @Query('active') active?: string,
  ) {
    const activeOnly = active === 'true' ? true : active === 'false' ? false : undefined;

    return this.billContext.getBills(familyId, activeOnly);
  }

  @Get('stats')
  async getBillStats(@FamilyId() familyId: string) {
    return this.billContext.getBillStats(familyId);
  }

  @Get(':id')
  async getBill(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.billContext.getBill(id, familyId);
  }

  @Get(':id/payments')
  async getBillPayments(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.billContext.getBillPayments(id, familyId);
  }

  @Post()
  async createBill(@FamilyId() familyId: string, @Body() input: CreateBillDto) {
    return this.billContext.createBill(familyId, input);
  }

  @Put(':id')
  async updateBill(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateBillDto,
  ) {
    return this.billContext.updateBill(id, familyId, input);
  }

  @Delete(':id')
  async deleteBill(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.billContext.deleteBill(id, familyId);

    return { message: 'Bill deleted successfully' };
  }

  @Post(':id/pay')
  async payBill(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: PayBillDto,
  ) {
    return this.billContext.payBill(id, familyId, input);
  }

  @Delete(':id/payments/:paymentId')
  async deleteBillPayment(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    await this.billContext.deleteBillPayment(id, paymentId, familyId);
    return { message: 'Payment deleted successfully' };
  }
}
