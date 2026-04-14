import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { InvoiceContextService } from './invoice-context.service';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';

@Injectable()
export class InvoiceExtensionsService {
  private mailTransporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceContext: InvoiceContextService,
  ) {
    this._initMailTransporter();
  }

  private _initMailTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.mailTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // 1. RECURRING INVOICES
  // ══════════════════════════════════════════════════════

  async getRecurringInvoices(familyId: string) {
    return this.prisma.recurringInvoice.findMany({
      where: { familyId },
      include: { seller: true, buyer: true },
      orderBy: { nextIssueDate: 'asc' },
    });
  }

  async getRecurringInvoice(familyId: string, id: string) {
    const rec = await this.prisma.recurringInvoice.findFirst({
      where: { id, familyId },
      include: { seller: true, buyer: true, invoices: { take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, number: true, status: true, totalGross: true, issueDate: true } } },
    });
    if (!rec) throw new NotFoundException('Recurring invoice not found');
    return rec;
  }

  async createRecurringInvoice(familyId: string, input: CreateRecurringInvoiceDto) {
    const [seller, buyer] = await Promise.all([
      this.prisma.company.findFirst({ where: { id: input.sellerId, familyId } }),
      this.prisma.company.findFirst({ where: { id: input.buyerId, familyId } }),
    ]);
    if (!seller) throw new BadRequestException('Nie znaleziono sprzedawcy');
    if (!buyer) throw new BadRequestException('Nie znaleziono nabywcy');

    return this.prisma.recurringInvoice.create({
      data: {
        familyId,
        name: input.name,
        frequency: input.frequency as any ?? 'MONTHLY',
        nextIssueDate: new Date(input.nextIssueDate),
        type: input.type ?? 'STANDARD',
        sellerId: input.sellerId,
        buyerId: input.buyerId,
        paymentMethod: input.paymentMethod ?? 'przelew',
        bankAccount: input.bankAccount ?? seller.bankAccount,
        currency: input.currency ?? 'PLN',
        dueDays: input.dueDays ?? 14,
        notes: input.notes,
        autoIssue: input.autoIssue ?? false,
        autoSend: input.autoSend ?? false,
        itemsTemplate: input.items.map((item, i) => ({
          sortOrder: item.sortOrder ?? i,
          description: item.description,
          unit: item.unit ?? 'usł.',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate ?? '23',
        })),
      },
      include: { seller: true, buyer: true },
    });
  }

  async updateRecurringInvoice(familyId: string, id: string, input: UpdateRecurringInvoiceDto) {
    const rec = await this.prisma.recurringInvoice.findFirst({ where: { id, familyId } });
    if (!rec) throw new NotFoundException('Recurring invoice not found');

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.nextIssueDate !== undefined) data.nextIssueDate = new Date(input.nextIssueDate);
    if (input.type !== undefined) data.type = input.type;
    if (input.sellerId !== undefined) data.sellerId = input.sellerId;
    if (input.buyerId !== undefined) data.buyerId = input.buyerId;
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
    if (input.bankAccount !== undefined) data.bankAccount = input.bankAccount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.dueDays !== undefined) data.dueDays = input.dueDays;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.autoIssue !== undefined) data.autoIssue = input.autoIssue;
    if (input.autoSend !== undefined) data.autoSend = input.autoSend;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.items !== undefined) {
      data.itemsTemplate = input.items.map((item, i) => ({
        sortOrder: item.sortOrder ?? i,
        description: item.description,
        unit: item.unit ?? 'usł.',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate ?? '23',
      }));
    }

    return this.prisma.recurringInvoice.update({
      where: { id },
      data,
      include: { seller: true, buyer: true },
    });
  }

  async deleteRecurringInvoice(familyId: string, id: string) {
    const rec = await this.prisma.recurringInvoice.findFirst({ where: { id, familyId } });
    if (!rec) throw new NotFoundException('Recurring invoice not found');
    await this.prisma.recurringInvoice.delete({ where: { id } });
    return { success: true };
  }

  async generateFromRecurring(familyId: string, id: string) {
    const rec = await this.prisma.recurringInvoice.findFirst({
      where: { id, familyId },
      include: { seller: true, buyer: true },
    });
    if (!rec) throw new NotFoundException('Recurring invoice not found');

    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + rec.dueDays * 86400000);
    const items = (rec.itemsTemplate as any[]).map((item: any, i: number) => ({
      sortOrder: item.sortOrder ?? i,
      description: item.description,
      unit: item.unit ?? 'usł.',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate ?? '23',
    }));

    const invoice = await this.invoiceContext.createInvoice(familyId, {
      type: rec.type,
      sellerId: rec.sellerId,
      buyerId: rec.buyerId,
      issueDate: issueDate.toISOString().split('T')[0],
      saleDate: issueDate.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      paymentMethod: rec.paymentMethod,
      bankAccount: rec.bankAccount ?? undefined,
      currency: rec.currency,
      notes: rec.notes ?? undefined,
      items,
    });

    // Link to recurring and update recurring metadata
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { recurringInvoiceId: rec.id },
    });

    // If autoIssue, issue the invoice
    if (rec.autoIssue) {
      await this.invoiceContext.issueInvoice(familyId, invoice.id);
    }

    // Advance nextIssueDate
    const nextDate = this._advanceDate(rec.nextIssueDate, rec.frequency);
    await this.prisma.recurringInvoice.update({
      where: { id: rec.id },
      data: { lastIssuedAt: new Date(), nextIssueDate: nextDate },
    });

    return invoice;
  }

  // Cron: every day at 6:00 AM - generate recurring invoices
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleRecurringInvoicesCron() {
    const now = new Date();
    const dueRecurring = await this.prisma.recurringInvoice.findMany({
      where: { isActive: true, nextIssueDate: { lte: now } },
    });

    for (const rec of dueRecurring) {
      try {
        await this.generateFromRecurring(rec.familyId, rec.id);
        console.log(`[Cron] Generated recurring invoice: ${rec.name}`);
      } catch (e) {
        console.error(`[Cron] Failed to generate recurring invoice ${rec.name}:`, e);
      }
    }
  }

  private _advanceDate(date: Date, frequency: string): Date {
    const next = new Date(date);
    switch (frequency) {
      case 'DAILY': next.setDate(next.getDate() + 1); break;
      case 'WEEKLY': next.setDate(next.getDate() + 7); break;
      case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
      case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
      case 'YEARLY': next.setFullYear(next.getFullYear() + 1); break;
      default: next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  // ══════════════════════════════════════════════════════
  // 2. OVERDUE DETECTION
  // ══════════════════════════════════════════════════════

  // Cron: every day at 7:00 AM - mark overdue invoices
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleOverdueDetectionCron() {
    const now = new Date();
    const result = await this.prisma.invoice.updateMany({
      where: {
        status: { in: ['ISSUED', 'SENT'] },
        isPaid: false,
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });

    if (result.count > 0) {
      console.log(`[Cron] Marked ${result.count} invoices as OVERDUE`);
    }
  }

  // Manual trigger for overdue check
  async checkOverdueInvoices(familyId: string) {
    const now = new Date();
    const result = await this.prisma.invoice.updateMany({
      where: {
        familyId,
        status: { in: ['ISSUED', 'SENT'] },
        isPaid: false,
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
    return { updated: result.count };
  }

  // ══════════════════════════════════════════════════════
  // 3. EMAIL SENDING
  // ══════════════════════════════════════════════════════

  async getEmailConfig() {
    return {
      configured: !!this.mailTransporter,
      host: process.env.SMTP_HOST ?? null,
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? null,
    };
  }

  async sendInvoiceEmail(familyId: string, invoiceId: string, input: SendInvoiceEmailDto) {
    if (!this.mailTransporter) {
      throw new BadRequestException('Konfiguracja SMTP nie jest ustawiona. Ustaw zmienne SMTP_HOST, SMTP_USER, SMTP_PASS w .env');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, familyId },
      include: { seller: true, buyer: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Faktura nie znaleziona');

    const recipientEmail = input.to ?? invoice.buyer.email;
    if (!recipientEmail) {
      throw new BadRequestException('Nabywca nie ma ustawionego adresu email');
    }

    const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
    const subject = input.subject ?? `Faktura ${invoice.number} - ${invoice.seller.name}`;
    const body = input.body ?? this._buildEmailBody(invoice);

    // Generate PDF data for attachment
    const pdfData = await this.invoiceContext.generateInvoicePdf(familyId, invoiceId);

    await this.mailTransporter.sendMail({
      from,
      to: recipientEmail,
      subject,
      html: body,
      attachments: [{
        filename: `${invoice.number.replace(/\//g, '-')}.html`,
        content: pdfData,
        contentType: 'text/html',
      }],
    });

    // Update invoice status and tracking
    const updateData: any = { sentAt: new Date(), sentTo: recipientEmail };
    if (invoice.status === 'ISSUED') updateData.status = 'SENT';

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    // Audit log
    await this._addAuditLog(invoiceId, 'SENT', { sentTo: recipientEmail });

    return { success: true, sentTo: recipientEmail };
  }

  private _buildEmailBody(invoice: any): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#333">Faktura ${invoice.number}</h2>
        <p>Szanowni Państwo,</p>
        <p>W załączeniu przesyłamy fakturę <strong>${invoice.number}</strong> na kwotę <strong>${Number(invoice.totalGross).toFixed(2)} ${invoice.currency}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:15px 0">
          <tr><td style="padding:5px;color:#666">Sprzedawca:</td><td style="padding:5px"><strong>${invoice.seller.name}</strong></td></tr>
          <tr><td style="padding:5px;color:#666">Data wystawienia:</td><td style="padding:5px">${new Date(invoice.issueDate).toLocaleDateString('pl-PL')}</td></tr>
          <tr><td style="padding:5px;color:#666">Termin płatności:</td><td style="padding:5px"><strong>${new Date(invoice.dueDate).toLocaleDateString('pl-PL')}</strong></td></tr>
          <tr><td style="padding:5px;color:#666">Kwota netto:</td><td style="padding:5px">${Number(invoice.totalNet).toFixed(2)} ${invoice.currency}</td></tr>
          <tr><td style="padding:5px;color:#666">Kwota brutto:</td><td style="padding:5px"><strong>${Number(invoice.totalGross).toFixed(2)} ${invoice.currency}</strong></td></tr>
          ${invoice.bankAccount ? `<tr><td style="padding:5px;color:#666">Nr konta:</td><td style="padding:5px;font-family:monospace">${invoice.bankAccount}</td></tr>` : ''}
        </table>
        <p>Prosimy o terminową wpłatę.</p>
        <p style="color:#999;font-size:12px">Wiadomość wygenerowana automatycznie przez Financio.</p>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════
  // 4. MULTI-CURRENCY + NBP EXCHANGE RATES
  // ══════════════════════════════════════════════════════

  async getNbpExchangeRate(currency: string, date?: string): Promise<{ rate: number; date: string; table: string }> {
    const code = currency.toUpperCase();
    if (code === 'PLN') return { rate: 1, date: date ?? new Date().toISOString().split('T')[0], table: '-' };

    // Try specific date, then fallback to latest
    const urls = date
      ? [
          `https://api.nbp.pl/api/exchangerates/rates/a/${code}/${date}/?format=json`,
          `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`,
        ]
      : [`https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`];

    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        const rate = data.rates?.[0];
        if (rate) {
          return { rate: rate.mid, date: rate.effectiveDate, table: rate.no };
        }
      } catch {
        continue;
      }
    }

    throw new BadRequestException(`Nie udało się pobrać kursu NBP dla ${code}`);
  }

  async getAvailableCurrencies(): Promise<string[]> {
    return ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK', 'JPY', 'CAD', 'AUD'];
  }

  // ══════════════════════════════════════════════════════
  // 5. AUDIT LOG (Historia zmian)
  // ══════════════════════════════════════════════════════

  async getAuditLog(familyId: string, invoiceId: string) {
    // Verify invoice belongs to family
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, familyId } });
    if (!invoice) throw new NotFoundException('Faktura nie znaleziona');

    return this.prisma.invoiceAuditLog.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async _addAuditLog(invoiceId: string, action: string, changes?: any, userId?: string, userName?: string) {
    return this.prisma.invoiceAuditLog.create({
      data: {
        invoiceId,
        action,
        changes: changes ?? null,
        userId,
        userName,
      },
    });
  }

  // ══════════════════════════════════════════════════════
  // 6. CORRECTION INVOICES (Korekty powiązane)
  // ══════════════════════════════════════════════════════

  async createCorrectionInvoice(familyId: string, originalInvoiceId: string) {
    const original = await this.prisma.invoice.findFirst({
      where: { id: originalInvoiceId, familyId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, seller: true, buyer: true },
    });
    if (!original) throw new NotFoundException('Oryginalna faktura nie znaleziona');
    if (original.status === 'DRAFT') throw new BadRequestException('Nie można skorygować szkicu');
    if (original.type === 'CORRECTION') throw new BadRequestException('Nie można skorygować faktury korygującej');

    const now = new Date();
    const dueDate = new Date(now.getTime() + 14 * 86400000);

    // Create correction with negated items
    const items = original.items.map((item, index) => ({
      sortOrder: index,
      description: `KOREKTA: ${item.description}`,
      unit: item.unit,
      quantity: -Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      vatRate: item.vatRate,
    }));

    const invoice = await this.invoiceContext.createInvoice(familyId, {
      type: 'CORRECTION',
      sellerId: original.sellerId,
      buyerId: original.buyerId,
      issueDate: now.toISOString().split('T')[0],
      saleDate: now.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      paymentMethod: original.paymentMethod,
      bankAccount: original.bankAccount ?? undefined,
      currency: original.currency,
      notes: `Korekta do faktury ${original.number}`,
      correctedInvoiceId: original.id,
      items,
    });

    await this._addAuditLog(original.id, 'CORRECTED', { correctionId: invoice.id, correctionNumber: invoice.number });
    await this._addAuditLog(invoice.id, 'CREATED', { correctedInvoiceId: original.id, originalNumber: original.number });

    return invoice;
  }

  // ══════════════════════════════════════════════════════
  // 7. JPK_FA XML EXPORT
  // ══════════════════════════════════════════════════════

  async generateJpkFa(familyId: string, dateFrom: string, dateTo: string): Promise<string> {
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        familyId,
        issueDate: { gte: startDate, lte: endDate },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        type: { not: 'PROFORMA' },
      },
      include: { seller: true, buyer: true, items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { issueDate: 'asc' },
    });

    if (invoices.length === 0) {
      throw new BadRequestException('Brak faktur do wyeksportowania w podanym zakresie dat');
    }

    const ownCompany = await this.prisma.company.findFirst({
      where: { familyId, isOwn: true },
    });
    if (!ownCompany) throw new BadRequestException('Nie skonfigurowano danych własnej firmy');

    const xml = this._buildJpkFaXml(ownCompany, invoices, dateFrom, dateTo);
    return xml;
  }

  private _buildJpkFaXml(company: any, invoices: any[], dateFrom: string, dateTo: string): string {
    const now = new Date().toISOString();
    const escXml = (s: string | null | undefined) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Summary calculations
    let totalNet = 0;
    let totalVat = 0;
    const vatByRate: Record<string, { net: number; vat: number }> = {};

    for (const inv of invoices) {
      totalNet += Number(inv.totalNet);
      totalVat += Number(inv.totalVat);
      for (const item of inv.items) {
        const rate = item.vatRate;
        if (!vatByRate[rate]) vatByRate[rate] = { net: 0, vat: 0 };
        vatByRate[rate].net += Number(item.netAmount);
        vatByRate[rate].vat += Number(item.vatAmount);
      }
    }

    const invoiceRows = invoices.map((inv, idx) => {
      const itemRows = inv.items.map((item: any, itemIdx: number) => `
        <FakturaWiersz>
          <P_2B>${escXml(inv.number)}</P_2B>
          <P_7>${escXml(item.description)}</P_7>
          <P_8A>${escXml(item.unit)}</P_8A>
          <P_8B>${Number(item.quantity).toFixed(4)}</P_8B>
          <P_9A>${Number(item.unitPrice).toFixed(2)}</P_9A>
          <P_11>${Number(item.netAmount).toFixed(2)}</P_11>
          <P_12>${item.vatRate === 'zw' ? 'zw' : item.vatRate === 'np' ? 'np' : item.vatRate}</P_12>
        </FakturaWiersz>`).join('');

      return `
      <Faktura>
        <P_1>${new Date(inv.issueDate).toISOString().split('T')[0]}</P_1>
        <P_2A>${escXml(inv.number)}</P_2A>
        <P_3A>${escXml(inv.seller.name)}</P_3A>
        <P_3B>${escXml(this._formatAddress(inv.seller))}</P_3B>
        <P_3C>${escXml(inv.buyer.name)}</P_3C>
        <P_3D>${escXml(this._formatAddress(inv.buyer))}</P_3D>
        <P_4A>${escXml(inv.seller.nip)}</P_4A>
        <P_5B>${escXml(inv.buyer.nip)}</P_5B>
        <P_6>${new Date(inv.saleDate).toISOString().split('T')[0]}</P_6>
        ${this._buildVatFields(inv.items)}
        <P_15>${Number(inv.totalGross).toFixed(2)}</P_15>
        <RodzajFaktury>${inv.type === 'CORRECTION' ? 'KOREKTA' : 'VAT'}</RodzajFaktury>
      </Faktura>${itemRows}`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2024/03/06/03061/"
     xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Naglowek>
    <KodFormularza kodSystemowy="JPK_FA (4)" wersjaSchemy="4-0">JPK_FA</KodFormularza>
    <WariantFormularza>4</WariantFormularza>
    <CelZlozenia>1</CelZlozenia>
    <DataWytworzeniaJPK>${now}</DataWytworzeniaJPK>
    <DataOd>${dateFrom}</DataOd>
    <DataDo>${dateTo}</DataDo>
    <NazwaSystemu>Financio</NazwaSystemu>
  </Naglowek>
  <Podmiot1>
    <IdentyfikatorPodmiotu>
      <etd:NIP>${escXml(company.nip)}</etd:NIP>
      <etd:PelnaNazwa>${escXml(company.name)}</etd:PelnaNazwa>
    </IdentyfikatorPodmiotu>
    <AdresPodmiotu>
      <Kraj>PL</Kraj>
      <Miejscowosc>${escXml(company.city)}</Miejscowosc>
      <KodPocztowy>${escXml(company.postalCode)}</KodPocztowy>
      <Ulica>${escXml(company.address)}</Ulica>
    </AdresPodmiotu>
  </Podmiot1>
  ${invoiceRows}
  <FakturaCtrl>
    <LiczbaFaktur>${invoices.length}</LiczbaFaktur>
    <WartoscFaktur>${totalNet.toFixed(2)}</WartoscFaktur>
  </FakturaCtrl>
</JPK>`;
  }

  private _formatAddress(company: any): string {
    const parts = [company.address, company.postalCode, company.city].filter(Boolean);
    return parts.join(', ');
  }

  private _buildVatFields(items: any[]): string {
    const byRate: Record<string, { net: number; vat: number }> = {};
    for (const item of items) {
      const r = item.vatRate;
      if (!byRate[r]) byRate[r] = { net: 0, vat: 0 };
      byRate[r].net += Number(item.netAmount);
      byRate[r].vat += Number(item.vatAmount);
    }

    let xml = '';
    if (byRate['23']) {
      xml += `<P_13_1>${byRate['23'].net.toFixed(2)}</P_13_1>\n        <P_14_1>${byRate['23'].vat.toFixed(2)}</P_14_1>\n        `;
    }
    if (byRate['8']) {
      xml += `<P_13_2>${byRate['8'].net.toFixed(2)}</P_13_2>\n        <P_14_2>${byRate['8'].vat.toFixed(2)}</P_14_2>\n        `;
    }
    if (byRate['5']) {
      xml += `<P_13_3>${byRate['5'].net.toFixed(2)}</P_13_3>\n        <P_14_3>${byRate['5'].vat.toFixed(2)}</P_14_3>\n        `;
    }
    if (byRate['0']) {
      xml += `<P_13_6_1>${byRate['0'].net.toFixed(2)}</P_13_6_1>\n        `;
    }
    if (byRate['zw']) {
      xml += `<P_13_7>${byRate['zw'].net.toFixed(2)}</P_13_7>\n        `;
    }
    return xml.trim();
  }

  // ══════════════════════════════════════════════════════
  // 8. TAX MODULE INTEGRATION
  // ══════════════════════════════════════════════════════

  async getInvoiceRevenueSummary(familyId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        familyId,
        type: { not: 'PROFORMA' },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        isPaid: true,
        paidAt: { gte: startDate, lte: endDate },
      },
      select: {
        totalNet: true,
        totalVat: true,
        totalGross: true,
        paidAt: true,
        currency: true,
      },
    });

    // Monthly breakdown
    const monthly: Record<number, { net: number; vat: number; gross: number; count: number }> = {};
    for (let m = 1; m <= 12; m++) monthly[m] = { net: 0, vat: 0, gross: 0, count: 0 };

    let yearNet = 0;
    let yearVat = 0;
    let yearGross = 0;

    for (const inv of invoices) {
      const month = inv.paidAt!.getMonth() + 1;
      const net = Number(inv.totalNet);
      const vat = Number(inv.totalVat);
      const gross = Number(inv.totalGross);

      monthly[month].net += net;
      monthly[month].vat += vat;
      monthly[month].gross += gross;
      monthly[month].count++;

      yearNet += net;
      yearVat += vat;
      yearGross += gross;
    }

    return {
      year,
      totalNet: Math.round(yearNet * 100) / 100,
      totalVat: Math.round(yearVat * 100) / 100,
      totalGross: Math.round(yearGross * 100) / 100,
      totalInvoices: invoices.length,
      monthly: Object.entries(monthly).map(([month, data]) => ({
        month: parseInt(month),
        ...data,
        net: Math.round(data.net * 100) / 100,
        vat: Math.round(data.vat * 100) / 100,
        gross: Math.round(data.gross * 100) / 100,
      })),
    };
  }

  // Detailed stats for charts
  async getInvoiceChartData(familyId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        familyId,
        issueDate: { gte: startDate, lte: endDate },
        type: { not: 'PROFORMA' },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      include: {
        items: true,
        buyer: { select: { name: true } },
      },
    });

    // Monthly revenue chart
    const monthlyRevenue: Array<{ month: string; net: number; vat: number; gross: number; paid: number; unpaid: number }> = [];
    const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
    const monthData: Record<number, { net: number; vat: number; gross: number; paid: number; unpaid: number }> = {};
    for (let m = 0; m < 12; m++) monthData[m] = { net: 0, vat: 0, gross: 0, paid: 0, unpaid: 0 };

    // VAT breakdown chart
    const vatBreakdown: Record<string, { net: number; vat: number; count: number }> = {};

    // Revenue by client
    const byClient: Record<string, { net: number; gross: number; count: number }> = {};

    for (const inv of invoices) {
      const m = new Date(inv.issueDate).getMonth();
      const net = Number(inv.totalNet);
      const vat = Number(inv.totalVat);
      const gross = Number(inv.totalGross);

      monthData[m].net += net;
      monthData[m].vat += vat;
      monthData[m].gross += gross;
      if (inv.isPaid) monthData[m].paid += gross;
      else monthData[m].unpaid += gross;

      // VAT breakdown
      for (const item of inv.items) {
        const rate = item.vatRate;
        if (!vatBreakdown[rate]) vatBreakdown[rate] = { net: 0, vat: 0, count: 0 };
        vatBreakdown[rate].net += Number(item.netAmount);
        vatBreakdown[rate].vat += Number(item.vatAmount);
        vatBreakdown[rate].count++;
      }

      // By client
      const clientName = inv.buyer.name;
      if (!byClient[clientName]) byClient[clientName] = { net: 0, gross: 0, count: 0 };
      byClient[clientName].net += net;
      byClient[clientName].gross += gross;
      byClient[clientName].count++;
    }

    for (let m = 0; m < 12; m++) {
      monthlyRevenue.push({
        month: monthNames[m],
        net: Math.round(monthData[m].net * 100) / 100,
        vat: Math.round(monthData[m].vat * 100) / 100,
        gross: Math.round(monthData[m].gross * 100) / 100,
        paid: Math.round(monthData[m].paid * 100) / 100,
        unpaid: Math.round(monthData[m].unpaid * 100) / 100,
      });
    }

    const vatPieChart = Object.entries(vatBreakdown).map(([rate, data]) => ({
      name: rate === 'zw' ? 'Zwolniony' : rate === 'np' ? 'Nie podlega' : `${rate}%`,
      value: Math.round(data.vat * 100) / 100,
      net: Math.round(data.net * 100) / 100,
      count: data.count,
    }));

    const clientChart = Object.entries(byClient)
      .sort((a, b) => b[1].gross - a[1].gross)
      .slice(0, 10)
      .map(([name, data]) => ({
        name,
        net: Math.round(data.net * 100) / 100,
        gross: Math.round(data.gross * 100) / 100,
        count: data.count,
      }));

    return {
      year,
      monthlyRevenue,
      vatPieChart,
      clientChart,
    };
  }

  // ══════════════════════════════════════════════════════
  // 9. PER-TYPE NUMBERING (ENHANCED)
  // ══════════════════════════════════════════════════════
  // This is handled by modifying the existing getNextInvoiceNumber
  // in invoice-context.service.ts - the numbering is already per-type
  // based on prefix (FV, FP, FK, FZ). No additional changes needed.
}
