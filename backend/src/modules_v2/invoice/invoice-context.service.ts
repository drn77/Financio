import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-paid.dto';

@Injectable()
export class InvoiceContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
  ) {}

  // ──────── Companies (Kontrahenci) ────────

  async getCompanies(familyId: string) {
    const companies = await this.prisma.company.findMany({
      where: { familyId },
      orderBy: [{ isOwn: 'desc' }, { name: 'asc' }],
    });
    return companies;
  }

  async getOwnCompany(familyId: string) {
    return this.prisma.company.findFirst({
      where: { familyId, isOwn: true },
    });
  }

  async createCompany(familyId: string, input: CreateCompanyDto) {
    // If marking as own, unmark any existing own company
    if (input.isOwn) {
      await this.prisma.company.updateMany({
        where: { familyId, isOwn: true },
        data: { isOwn: false },
      });
    }

    return this.prisma.company.create({
      data: {
        familyId,
        name: input.name,
        nip: input.nip,
        regon: input.regon,
        address: input.address,
        city: input.city,
        postalCode: input.postalCode,
        country: input.country ?? 'Polska',
        email: input.email,
        phone: input.phone,
        bankName: input.bankName,
        bankAccount: input.bankAccount,
        isOwn: input.isOwn ?? false,
      },
    });
  }

  async updateCompany(familyId: string, id: string, input: UpdateCompanyDto) {
    const company = await this.prisma.company.findFirst({ where: { id, familyId } });
    if (!company) throw new NotFoundException('Company not found');

    // If marking as own, unmark any existing own company
    if (input.isOwn && !company.isOwn) {
      await this.prisma.company.updateMany({
        where: { familyId, isOwn: true },
        data: { isOwn: false },
      });
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.nip !== undefined ? { nip: input.nip } : {}),
        ...(input.regon !== undefined ? { regon: input.regon } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
        ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
        ...(input.isOwn !== undefined ? { isOwn: input.isOwn } : {}),
      },
    });
  }

  async deleteCompany(familyId: string, id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, familyId } });
    if (!company) throw new NotFoundException('Company not found');

    // Check if used in any invoices
    const invoiceCount = await this.prisma.invoice.count({
      where: { OR: [{ sellerId: id }, { buyerId: id }] },
    });
    if (invoiceCount > 0) {
      throw new BadRequestException('Nie można usunąć firmy, która jest używana w fakturach');
    }

    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  // ──────── Invoices (Faktury) ────────

  async getInvoices(familyId: string, filters?: { month?: number; year?: number; status?: string }) {
    const where: any = { familyId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.month && filters?.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      where.issueDate = { gte: startDate, lte: endDate };
    } else if (filters?.year) {
      const startDate = new Date(filters.year, 0, 1);
      const endDate = new Date(filters.year, 11, 31, 23, 59, 59);
      where.issueDate = { gte: startDate, lte: endDate };
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        seller: true,
        buyer: true,
        items: { orderBy: { sortOrder: 'asc' } },
        corrections: { select: { id: true, number: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getInvoice(familyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, familyId },
      include: {
        seller: true,
        buyer: true,
        items: { orderBy: { sortOrder: 'asc' } },
        correctedInvoice: { select: { id: true, number: true } },
        corrections: { select: { id: true, number: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async getNextInvoiceNumber(familyId: string, type: string, issueDate: string) {
    const date = new Date(issueDate);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const prefix = this._getInvoicePrefix(type);

    // Count invoices this month with this prefix
    const startOfMonth = new Date(year, date.getMonth(), 1);
    const endOfMonth = new Date(year, date.getMonth() + 1, 0, 23, 59, 59);

    const count = await this.prisma.invoice.count({
      where: {
        familyId,
        number: { startsWith: `${prefix}/` },
        issueDate: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    return `${prefix}/${String(count + 1).padStart(2, '0')}/${month}/${year}`;
  }

  async createInvoice(familyId: string, input: CreateInvoiceDto) {
    // Validate seller and buyer belong to this family
    const [seller, buyer] = await Promise.all([
      this.prisma.company.findFirst({ where: { id: input.sellerId, familyId } }),
      this.prisma.company.findFirst({ where: { id: input.buyerId, familyId } }),
    ]);
    if (!seller) throw new BadRequestException('Seller company not found');
    if (!buyer) throw new BadRequestException('Buyer company not found');

    // Calculate item totals
    const items = input.items.map((item, index) => {
      const netAmount = this._round(item.quantity * item.unitPrice);
      const vatAmount = this._calculateVat(netAmount, item.vatRate);
      const grossAmount = this._round(netAmount + vatAmount);

      return {
        sortOrder: item.sortOrder ?? index,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        netAmount,
        vatAmount,
        grossAmount,
      };
    });

    const totalNet = this._round(items.reduce((sum, i) => sum + i.netAmount, 0));
    const totalVat = this._round(items.reduce((sum, i) => sum + i.vatAmount, 0));
    const totalGross = this._round(items.reduce((sum, i) => sum + i.grossAmount, 0));

    // Generate invoice number
    const number = await this.getNextInvoiceNumber(familyId, input.type, input.issueDate);

    const invoice = await this.prisma.invoice.create({
      data: {
        familyId,
        number,
        type: input.type,
        status: 'DRAFT',
        issueDate: new Date(input.issueDate),
        saleDate: new Date(input.saleDate),
        dueDate: new Date(input.dueDate),
        sellerId: input.sellerId,
        buyerId: input.buyerId,
        paymentMethod: input.paymentMethod ?? 'przelew',
        bankAccount: input.bankAccount ?? seller.bankAccount,
        currency: input.currency ?? 'PLN',
        totalNet,
        totalVat,
        totalGross,
        notes: input.notes,
        title: input.title,
        issuePlace: input.issuePlace,
        correctedInvoiceId: input.correctedInvoiceId,
        items: {
          create: items,
        },
      },
      include: {
        seller: true,
        buyer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this._logAudit(invoice.id, 'CREATED', { number: invoice.number, type: input.type });
    return invoice;
  }

  async updateInvoice(familyId: string, id: string, input: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, familyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.isPaid) {
      throw new BadRequestException('Nie można edytować opłaconej faktury');
    }

    const data: any = {};

    if (input.type !== undefined) data.type = input.type;
    if (input.sellerId !== undefined) data.sellerId = input.sellerId;
    if (input.buyerId !== undefined) data.buyerId = input.buyerId;
    if (input.issueDate !== undefined) data.issueDate = new Date(input.issueDate);
    if (input.saleDate !== undefined) data.saleDate = new Date(input.saleDate);
    if (input.dueDate !== undefined) data.dueDate = new Date(input.dueDate);
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
    if (input.bankAccount !== undefined) data.bankAccount = input.bankAccount;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.title !== undefined) data.title = input.title;
    if (input.issuePlace !== undefined) data.issuePlace = input.issuePlace;
    if (input.status !== undefined) data.status = input.status;

    // If items provided, recalculate everything
    if (input.items) {
      // Delete old items
      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const items = input.items.map((item, index) => {
        const netAmount = this._round(item.quantity * item.unitPrice);
        const vatAmount = this._calculateVat(netAmount, item.vatRate);
        const grossAmount = this._round(netAmount + vatAmount);

        return {
          invoiceId: id,
          sortOrder: item.sortOrder ?? index,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          netAmount,
          vatAmount,
          grossAmount,
        };
      });

      data.totalNet = this._round(items.reduce((sum, i) => sum + i.netAmount, 0));
      data.totalVat = this._round(items.reduce((sum, i) => sum + i.vatAmount, 0));
      data.totalGross = this._round(items.reduce((sum, i) => sum + i.grossAmount, 0));

      await this.prisma.invoiceItem.createMany({ data: items });
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data,
      include: {
        seller: true,
        buyer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this._logAudit(id, 'UPDATED', { fields: Object.keys(data) });
    return updated;
  }

  async issueInvoice(familyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, familyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const issued = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'ISSUED' },
      include: {
        seller: true,
        buyer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this._logAudit(id, 'ISSUED');
    return issued;
  }

  async markInvoicePaid(familyId: string, id: string, input: MarkInvoicePaidDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, familyId },
      include: { items: true, seller: true, buyer: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const paidAmount = input.paidAmount ?? Number(invoice.totalGross);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        isPaid: true,
        paidAt: paymentDate,
        paidAmount,
        status: 'PAID',
      },
      include: {
        seller: true,
        buyer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    // Auto-create expense/income record
    try {
      const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
      if (defaultTemplate) {
        const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
        const autoExpenseData = await this._buildInvoiceAutoExpenseData(
          familyId,
          defaultTemplate.columns,
          updated,
          paymentDate,
        );

        await this.recordActions.createRecord({
          templateId: defaultTemplate.id,
          data: autoExpenseData,
          sortOrder: maxSort + 1,
        });
      }
    } catch (e) {
      console.error('Invoice auto-expense creation failed:', e);
    }

    await this._logAudit(id, 'PAID', { paidAmount, paymentDate: paymentDate.toISOString() });
    return updated;
  }

  async deleteInvoice(familyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, familyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.isPaid) {
      throw new BadRequestException('Nie można usunąć opłaconej faktury');
    }

    await this._logAudit(id, 'DELETED', { number: invoice.number });
    await this.prisma.invoice.delete({ where: { id } });
    return { success: true };
  }

  // ──────── Invoice Stats ────────

  async getInvoiceStats(familyId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const startDate = new Date(y, 0, 1);
    const endDate = new Date(y, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        familyId,
        issueDate: { gte: startDate, lte: endDate },
        type: { not: 'PROFORMA' },
        status: { not: 'CANCELLED' },
      },
      select: {
        totalNet: true,
        totalGross: true,
        isPaid: true,
        status: true,
        issueDate: true,
      },
    });

    let totalNet = 0;
    let totalGross = 0;
    let paidNet = 0;
    let paidGross = 0;
    let unpaidGross = 0;
    let overdueCount = 0;

    const now = new Date();
    for (const inv of invoices) {
      totalNet += Number(inv.totalNet);
      totalGross += Number(inv.totalGross);
      if (inv.isPaid) {
        paidNet += Number(inv.totalNet);
        paidGross += Number(inv.totalGross);
      } else {
        unpaidGross += Number(inv.totalGross);
        if (inv.status === 'OVERDUE') overdueCount++;
      }
    }

    return {
      year: y,
      totalInvoices: invoices.length,
      totalNet: this._round(totalNet),
      totalGross: this._round(totalGross),
      paidNet: this._round(paidNet),
      paidGross: this._round(paidGross),
      unpaidGross: this._round(unpaidGross),
      overdueCount,
    };
  }

  // ──────── PDF Generation ────────

  async generateInvoicePdf(familyId: string, id: string): Promise<Buffer> {
    const invoice = await this.getInvoice(familyId, id);

    // Build PDF content using a structured table layout
    const pdfContent = this._buildPdfContent(invoice);
    return pdfContent;
  }

  private _buildPdfContent(invoice: any): Buffer {
    // Simple structured HTML-like content that will be rendered by frontend
    // We return JSON data; frontend handles PDF rendering with jspdf or browser print
    const data = {
      invoice: {
        number: invoice.number,
        type: invoice.type,
        title: invoice.title,
        issuePlace: invoice.issuePlace,
        issueDate: invoice.issueDate,
        saleDate: invoice.saleDate,
        dueDate: invoice.dueDate,
        paymentMethod: invoice.paymentMethod,
        bankAccount: invoice.bankAccount,
        currency: invoice.currency,
        notes: invoice.notes,
        totalNet: Number(invoice.totalNet),
        totalVat: Number(invoice.totalVat),
        totalGross: Number(invoice.totalGross),
      },
      seller: {
        name: invoice.seller.name,
        nip: invoice.seller.nip,
        address: invoice.seller.address,
        city: invoice.seller.city,
        postalCode: invoice.seller.postalCode,
        bankName: invoice.seller.bankName,
        bankAccount: invoice.seller.bankAccount ?? invoice.bankAccount,
      },
      buyer: {
        name: invoice.buyer.name,
        nip: invoice.buyer.nip,
        address: invoice.buyer.address,
        city: invoice.buyer.city,
        postalCode: invoice.buyer.postalCode,
      },
      items: invoice.items.map((item: any) => ({
        sortOrder: item.sortOrder,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRate: item.vatRate,
        netAmount: Number(item.netAmount),
        vatAmount: Number(item.vatAmount),
        grossAmount: Number(item.grossAmount),
      })),
      vatSummary: this._calculateVatSummary(invoice.items),
    };

    return Buffer.from(JSON.stringify(data), 'utf-8');
  }

  private _calculateVatSummary(items: any[]): { vatRate: string; netAmount: number; vatAmount: number; grossAmount: number }[] {
    const byRate: Record<string, { net: number; vat: number; gross: number }> = {};

    for (const item of items) {
      const rate = item.vatRate;
      if (!byRate[rate]) byRate[rate] = { net: 0, vat: 0, gross: 0 };
      byRate[rate].net += Number(item.netAmount);
      byRate[rate].vat += Number(item.vatAmount);
      byRate[rate].gross += Number(item.grossAmount);
    }

    return Object.entries(byRate).map(([vatRate, amounts]) => ({
      vatRate,
      netAmount: this._round(amounts.net),
      vatAmount: this._round(amounts.vat),
      grossAmount: this._round(amounts.gross),
    }));
  }

  // ──────── Auto-Expense for Invoice Payment ────────

  private _extractTemplateColumns(templateColumns: any): { id: string; type?: string; tagGroupId?: string; name?: string }[] {
    return Array.isArray(templateColumns)
      ? templateColumns.filter((c: any) => c && typeof c.id === 'string')
      : [];
  }

  private async _loadInvoiceFieldConfigs(familyId: string): Promise<Record<string, any>> {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { dashboardConfig: true },
    });
    const dc = (family?.dashboardConfig as any) ?? {};
    return dc?.expenseMappings?.invoices?.fieldConfigs ?? {};
  }

  private async _buildTagIdToNameMap(familyId: string, tagIds: string[]): Promise<Record<string, string>> {
    if (!tagIds.length) return {};
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, tagGroup: { familyId } },
      select: { id: true, name: true },
    });
    const map: Record<string, string> = {};
    for (const tag of tags) map[tag.id] = tag.name;
    return map;
  }

  private async _buildInvoiceAutoExpenseData(
    familyId: string,
    templateColumnsRaw: any,
    invoice: any,
    paymentDate: Date,
  ): Promise<Record<string, any>> {
    const columns = this._extractTemplateColumns(templateColumnsRaw);
    const fieldConfigs = await this._loadInvoiceFieldConfigs(familyId);
    const hasConfig = Object.keys(fieldConfigs).length > 0;

    const itemsSummary = (invoice.items ?? [])
      .map((i: any) => `${i.description} (${Number(i.quantity)} ${i.unit} × ${Number(i.unitPrice)} zł)`)
      .join(', ');

    const sourceValues: Record<string, any> = {
      number: invoice.number,
      buyer: invoice.buyer?.name ?? '',
      amount: { amount: Number(invoice.totalGross), currency: invoice.currency ?? 'PLN' },
      netAmount: { amount: Number(invoice.totalNet), currency: invoice.currency ?? 'PLN' },
      issueDate: new Date(invoice.issueDate).toISOString().split('T')[0],
      paymentDate: paymentDate.toISOString().split('T')[0],
      dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
      notes: invoice.notes ?? '',
      description: `Faktura ${invoice.number} - ${invoice.buyer?.name ?? ''}`,
      items: itemsSummary,
    };

    const data: Record<string, any> = {
      _invoiceId: invoice.id,
      _invoiceNumber: invoice.number,
      _invoiceBuyer: invoice.buyer?.name ?? '',
      _invoiceDate: sourceValues.issueDate,
    };

    if (hasConfig) {
      const autoTagIdPool = new Set<string>();

      for (const column of columns) {
        const columnId = String(column.id);
        const cfg = fieldConfigs[columnId];
        if (!cfg || cfg.mode === 'none') continue;

        if (cfg.mode === 'auto_tags' && column.type === 'tag_group') {
          for (const tagId of cfg.autoTagIds ?? []) autoTagIdPool.add(tagId);
          continue;
        }

        if (cfg.mode === 'map' && cfg.sourceField) {
          const value = sourceValues[cfg.sourceField];
          if (value != null) data[columnId] = value;
        }
      }

      // Resolve auto_tags
      if (autoTagIdPool.size > 0) {
        const tagNameMap = await this._buildTagIdToNameMap(familyId, Array.from(autoTagIdPool));
        for (const column of columns) {
          const cfg = fieldConfigs[column.id];
          if (!cfg || cfg.mode !== 'auto_tags' || column.type !== 'tag_group') continue;
          const names = (cfg.autoTagIds ?? []).map((id: string) => tagNameMap[id]).filter(Boolean);
          if (names.length > 0) data[column.id] = names;
        }
      }
    } else {
      // Legacy fallback
      data.col_date = sourceValues.paymentDate;
      data.col_amount = sourceValues.amount;
      data.col_description = sourceValues.description;
    }

    return data;
  }

  // ──────── Helpers ────────

  private _getInvoicePrefix(type: string): string {
    switch (type) {
      case 'PROFORMA': return 'FP';
      case 'CORRECTION': return 'FK';
      case 'ADVANCE': return 'FZ';
      case 'VAT_EXEMPT': return 'FBV';
      default: return 'FV';
    }
  }

  private _calculateVat(netAmount: number, vatRate: string): number {
    if (vatRate === 'zw' || vatRate === 'np') return 0;
    const rate = parseFloat(vatRate);
    if (isNaN(rate)) return 0;
    return this._round(netAmount * rate / 100);
  }

  private _round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async _logAudit(invoiceId: string, action: string, changes?: any) {
    try {
      await this.prisma.invoiceAuditLog.create({
        data: { invoiceId, action, changes: changes ?? null },
      });
    } catch { /* audit should not break main flow */ }
  }
}
