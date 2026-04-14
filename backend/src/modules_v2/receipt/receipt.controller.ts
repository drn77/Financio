import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId, UserId } from '../../shared/decorators/session.decorator';
import { ReceiptContextService } from './receipt-context.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { UpdateReceiptConfigDto } from './dto/update-receipt-config.dto';
import { ExtractPdfTextDto } from './dto/extract-pdf-text.dto';
import { ParseReceiptAiDto } from './dto/parse-receipt-ai.dto';

@Controller('v2/receipts')
@UseGuards(SessionAuthGuard)
export class ReceiptController {
  constructor(private readonly receiptContext: ReceiptContextService) {}

  @Get()
  async getReceipts(
    @FamilyId() familyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
    @Query('personId') personId?: string,
    @Query('storeId') storeId?: string,
    @Query('search') search?: string,
  ) {
    return this.receiptContext.getReceipts(familyId, { from, to, categoryId, personId, storeId, search });
  }

  @Get('stats')
  async getStats(
    @FamilyId() familyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.receiptContext.getStats(familyId, from, to);
  }

  @Get('config')
  async getConfig(@FamilyId() familyId: string) {
    return this.receiptContext.getConfig(familyId);
  }

  @Put('config')
  async updateConfig(@FamilyId() familyId: string, @Body() input: UpdateReceiptConfigDto) {
    return this.receiptContext.updateConfig(familyId, input);
  }

  @Get('duplicate-check')
  async checkDuplicate(
    @FamilyId() familyId: string,
    @Query('amount') amount: string,
    @Query('date') date: string,
  ) {
    return this.receiptContext.checkDuplicate(familyId, parseFloat(amount), date);
  }

  @Get('suggest-category')
  async suggestCategory(
    @FamilyId() familyId: string,
    @Query('description') description: string,
  ) {
    return this.receiptContext.suggestCategory(familyId, description);
  }

  @Get(':id')
  async getReceipt(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.receiptContext.getReceipt(id, familyId);
  }

  @Post()
  async createReceipt(
    @FamilyId() familyId: string,
    @UserId() userId: string,
    @Body() input: CreateReceiptDto,
  ) {
    return this.receiptContext.createReceipt(familyId, userId, input);
  }

  @Post(':id/duplicate')
  async duplicateReceipt(
    @FamilyId() familyId: string,
    @UserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.receiptContext.duplicateReceipt(id, familyId, userId);
  }

  @Post(':id/create-expense')
  async createExpenseFromReceipt(
    @FamilyId() familyId: string,
    @Param('id') id: string,
  ) {
    return this.receiptContext.createExpenseFromReceipt(id, familyId);
  }

  @Post('extract-pdf-text')
  async extractPdfText(@FamilyId() familyId: string, @Body() input: ExtractPdfTextDto) {
    return this.receiptContext.extractPdfText(familyId, input.dataUrl);
  }

  @Post('parse-receipt-ai')
  async parseReceiptAI(@Body() input: ParseReceiptAiDto) {
    return this.receiptContext.parseReceiptAI(input.text);
  }

  @Put(':id')
  async updateReceipt(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateReceiptDto,
  ) {
    return this.receiptContext.updateReceipt(id, familyId, input);
  }

  @Delete(':id')
  async deleteReceipt(@FamilyId() familyId: string, @Param('id') id: string) {
    await this.receiptContext.deleteReceipt(id, familyId);
    return { message: 'Receipt deleted successfully' };
  }
}
