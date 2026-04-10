import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { InvoiceContextService } from './invoice-context.service';
import { InvoiceExtensionsService } from './invoice-extensions.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-paid.dto';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';

@Controller('v2/invoice')
@UseGuards(SessionAuthGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceContext: InvoiceContextService,
    private readonly invoiceExtensions: InvoiceExtensionsService,
  ) {}

  // ──────── Companies ────────

  @Get('companies')
  async getCompanies(@FamilyId() familyId: string) {
    return this.invoiceContext.getCompanies(familyId);
  }

  @Get('companies/own')
  async getOwnCompany(@FamilyId() familyId: string) {
    return this.invoiceContext.getOwnCompany(familyId);
  }

  @Post('companies')
  async createCompany(@FamilyId() familyId: string, @Body() input: CreateCompanyDto) {
    return this.invoiceContext.createCompany(familyId, input);
  }

  @Put('companies/:id')
  async updateCompany(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateCompanyDto,
  ) {
    return this.invoiceContext.updateCompany(familyId, id, input);
  }

  @Delete('companies/:id')
  async deleteCompany(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceContext.deleteCompany(familyId, id);
  }

  // ──────── Invoices ────────

  @Get('invoices')
  async getInvoices(
    @FamilyId() familyId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
  ) {
    return this.invoiceContext.getInvoices(familyId, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      status,
    });
  }

  @Get('invoices/stats')
  async getStats(
    @FamilyId() familyId: string,
    @Query('year') year?: string,
  ) {
    return this.invoiceContext.getInvoiceStats(familyId, year ? Number(year) : undefined);
  }

  @Get('invoices/next-number')
  async getNextNumber(
    @FamilyId() familyId: string,
    @Query('type') type: string,
    @Query('issueDate') issueDate: string,
  ) {
    const number = await this.invoiceContext.getNextInvoiceNumber(familyId, type ?? 'STANDARD', issueDate ?? new Date().toISOString());
    return { number };
  }

  @Get('invoices/:id')
  async getInvoice(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceContext.getInvoice(familyId, id);
  }

  @Get('invoices/:id/pdf')
  async getInvoicePdf(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoiceContext.generateInvoicePdf(familyId, id);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="faktura.json"`,
    });
    res.send(pdfBuffer);
  }

  @Post('invoices')
  async createInvoice(@FamilyId() familyId: string, @Body() input: CreateInvoiceDto) {
    return this.invoiceContext.createInvoice(familyId, input);
  }

  @Put('invoices/:id')
  async updateInvoice(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateInvoiceDto,
  ) {
    return this.invoiceContext.updateInvoice(familyId, id, input);
  }

  @Post('invoices/:id/issue')
  async issueInvoice(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceContext.issueInvoice(familyId, id);
  }

  @Post('invoices/:id/pay')
  async markPaid(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: MarkInvoicePaidDto,
  ) {
    return this.invoiceContext.markInvoicePaid(familyId, id, input);
  }

  @Delete('invoices/:id')
  async deleteInvoice(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceContext.deleteInvoice(familyId, id);
  }

  // ──────── Recurring Invoices ────────

  @Get('recurring')
  async getRecurringInvoices(@FamilyId() familyId: string) {
    return this.invoiceExtensions.getRecurringInvoices(familyId);
  }

  @Get('recurring/:id')
  async getRecurringInvoice(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceExtensions.getRecurringInvoice(familyId, id);
  }

  @Post('recurring')
  async createRecurringInvoice(@FamilyId() familyId: string, @Body() input: CreateRecurringInvoiceDto) {
    return this.invoiceExtensions.createRecurringInvoice(familyId, input);
  }

  @Put('recurring/:id')
  async updateRecurringInvoice(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: UpdateRecurringInvoiceDto,
  ) {
    return this.invoiceExtensions.updateRecurringInvoice(familyId, id, input);
  }

  @Delete('recurring/:id')
  async deleteRecurringInvoice(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceExtensions.deleteRecurringInvoice(familyId, id);
  }

  @Post('recurring/:id/generate')
  async generateFromRecurring(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceExtensions.generateFromRecurring(familyId, id);
  }

  // ──────── Email ────────

  @Get('email/config')
  async getEmailConfig() {
    return this.invoiceExtensions.getEmailConfig();
  }

  @Post('invoices/:id/send')
  async sendInvoiceEmail(
    @FamilyId() familyId: string,
    @Param('id') id: string,
    @Body() input: SendInvoiceEmailDto,
  ) {
    return this.invoiceExtensions.sendInvoiceEmail(familyId, id, input);
  }

  // ──────── Overdue ────────

  @Post('invoices/check-overdue')
  async checkOverdue(@FamilyId() familyId: string) {
    return this.invoiceExtensions.checkOverdueInvoices(familyId);
  }

  // ──────── Multi-currency / NBP ────────

  @Get('currencies')
  async getCurrencies() {
    return this.invoiceExtensions.getAvailableCurrencies();
  }

  @Get('exchange-rate/:currency')
  async getExchangeRate(
    @Param('currency') currency: string,
    @Query('date') date?: string,
  ) {
    return this.invoiceExtensions.getNbpExchangeRate(currency, date);
  }

  // ──────── Audit Log ────────

  @Get('invoices/:id/audit')
  async getAuditLog(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceExtensions.getAuditLog(familyId, id);
  }

  // ──────── Correction Invoices ────────

  @Post('invoices/:id/correct')
  async createCorrection(@FamilyId() familyId: string, @Param('id') id: string) {
    return this.invoiceExtensions.createCorrectionInvoice(familyId, id);
  }

  // ──────── JPK_FA Export ────────

  @Get('jpk-fa')
  async exportJpkFa(
    @FamilyId() familyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() res: Response,
  ) {
    const xml = await this.invoiceExtensions.generateJpkFa(familyId, dateFrom, dateTo);
    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="JPK_FA_${dateFrom}_${dateTo}.xml"`,
    });
    res.send(xml);
  }

  // ──────── Charts / Stats ────────

  @Get('chart-data')
  async getChartData(@FamilyId() familyId: string, @Query('year') year?: string) {
    return this.invoiceExtensions.getInvoiceChartData(familyId, year ? Number(year) : new Date().getFullYear());
  }

  @Get('revenue-summary')
  async getRevenueSummary(@FamilyId() familyId: string, @Query('year') year?: string) {
    return this.invoiceExtensions.getInvoiceRevenueSummary(familyId, year ? Number(year) : new Date().getFullYear());
  }
}
