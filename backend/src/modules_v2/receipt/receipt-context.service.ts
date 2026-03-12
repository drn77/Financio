import { BadRequestException, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { ReceiptActionsService } from './receipt-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

@Injectable()
export class ReceiptContextService implements OnModuleInit {
  private readonly logger = new Logger(ReceiptContextService.name);

  constructor(
    private readonly receiptActions: ReceiptActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
  ) {}

  // #region Private
  private async _autoCreateExpense(
    familyId: string,
    receipt: { id: string; description: string; amount: number; currency?: string; date: Date; notes?: string | null },
  ) {
    try {
      const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
      if (!defaultTemplate) return;

      const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);

      const columns = Array.isArray((defaultTemplate as any).columns) ? ((defaultTemplate as any).columns as any[]) : [];
      const recordData: Record<string, any> = {
        _receiptId: receipt.id,
        _receiptDescription: receipt.description,
      };

      const firstCurrencyCol = columns.find((c: any) => c?.type === 'currency' && typeof c?.id === 'string');
      if (firstCurrencyCol) {
        recordData[firstCurrencyCol.id] = {
          amount: Number(receipt.amount),
          currency: receipt.currency ?? 'PLN',
        };
      } else {
        recordData.col_amount = { amount: Number(receipt.amount), currency: receipt.currency ?? 'PLN' };
      }

      const firstDateCol = columns.find((c: any) => c?.type === 'date' && typeof c?.id === 'string');
      if (firstDateCol) {
        recordData[firstDateCol.id] = new Date(receipt.date).toISOString().split('T')[0];
      } else {
        recordData.col_date = new Date(receipt.date).toISOString().split('T')[0];
      }

      const firstNameCol = columns.find((c: any) => c?.type === 'text' && typeof c?.id === 'string' && /name|nazwa|description|opis/i.test(String(c?.id ?? '') + ' ' + String(c?.name ?? '')));
      if (firstNameCol) {
        recordData[firstNameCol.id] = receipt.description;
      } else {
        recordData.col_name = receipt.description;
      }

      const firstNotesCol = columns.find((c: any) => c?.type === 'text' && typeof c?.id === 'string' && /notes|notat/i.test(String(c?.id ?? '') + ' ' + String(c?.name ?? '')));
      if (firstNotesCol && receipt.notes) {
        recordData[firstNotesCol.id] = receipt.notes;
      }

      const paidCheckboxCol = columns.find((c: any) => c?.type === 'checkbox' && typeof c?.id === 'string' && /paid|oplac|zaplac|rozlicz/i.test(String(c?.id ?? '') + ' ' + String(c?.name ?? '')));
      if (paidCheckboxCol) {
        recordData[paidCheckboxCol.id] = true;
      } else {
        recordData.col_paid = true;
      }

      await this.recordActions.createRecord({
        templateId: defaultTemplate.id,
        data: recordData,
        sortOrder: maxSort + 1,
      });
    } catch (e) {
      this.logger.error('Auto-expense creation failed for receipt', e);
    }
  }
  // #endregion

  onModuleInit() {
    this.runImageCleanup();
    setInterval(() => this.runImageCleanup(), 24 * 60 * 60 * 1000);
  }

  private async runImageCleanup() {
    try {
      const result = await this.receiptActions.cleanupExpiredReceipts();
      if (result.cleaned > 0) {
        this.logger.log(`Cleaned up ${result.cleaned} expired receipt(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to clean up expired receipts', e);
    }
  }

  // #region Create
  async createReceipt(familyId: string, userId: string, input: CreateReceiptDto) {
    // Auto-suggest category if none provided
    let categoryId = input.categoryId;
    if (!categoryId && input.description) {
      const suggested = await this.receiptActions.suggestCategory(familyId, input.description);
      if (suggested) categoryId = suggested;
    }

    const receipt = await this.receiptActions.createReceipt({
      familyId,
      userId,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      date: new Date(input.date),
      categoryId,
      personId: input.personId,
      storeId: input.storeId,
      billId: input.billId,
      imageUrl: input.imageUrl,
      notes: input.notes,
      items: input.items,
      tagIds: input.tagIds,
      ocrStatus: input.ocrStatus,
      ocrError: input.ocrError,
      isApproved: input.isApproved,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : undefined,
    });

    return receipt;
  }

  async duplicateReceipt(id: string, familyId: string, userId: string) {
    const existing = await this.receiptActions.findReceiptById(id, familyId);
    if (!existing) throw new NotFoundException('Receipt not found');

    const receipt = await this.receiptActions.createReceipt({
      familyId,
      userId,
      description: existing.description,
      amount: existing.amount,
      currency: existing.currency,
      date: new Date(),
      categoryId: existing.categoryId,
      personId: existing.personId,
      storeId: existing.storeId,
      billId: existing.billId,
      notes: existing.notes,
      items: existing.items.map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
        categoryId: i.categoryId,
      })),
      tagIds: existing.tags.map((t: any) => t.id),
      ocrStatus: 'COMPLETED',
      isApproved: false,
    });

    return receipt;
  }
  // #endregion

  // #region Read
  async getReceipts(
    familyId: string,
    filters?: { from?: string; to?: string; categoryId?: string; personId?: string; storeId?: string; search?: string },
  ) {
    return this.receiptActions.findReceiptsByFamily(familyId, {
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      categoryId: filters?.categoryId,
      personId: filters?.personId,
      storeId: filters?.storeId,
      search: filters?.search,
    });
  }

  async getReceipt(id: string, familyId: string) {
    const receipt = await this.receiptActions.findReceiptById(id, familyId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    return receipt;
  }

  async getStats(familyId: string, from?: string, to?: string) {
    return this.receiptActions.getReceiptStats(
      familyId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  async checkDuplicate(familyId: string, amount: number, date: string) {
    return this.receiptActions.checkDuplicate(familyId, amount, new Date(date));
  }

  async suggestCategory(familyId: string, description: string) {
    const categoryId = await this.receiptActions.suggestCategory(familyId, description);
    return { categoryId };
  }
  // #endregion

  // #region Update
  async updateReceipt(id: string, familyId: string, input: UpdateReceiptDto) {
    const existing = await this.receiptActions.findReceiptById(id, familyId);
    if (!existing) throw new NotFoundException('Receipt not found');

    return this.receiptActions.updateReceipt(id, familyId, {
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      date: input.date ? new Date(input.date) : undefined,
      categoryId: input.categoryId,
      personId: input.personId,
      storeId: input.storeId,
      billId: input.billId,
      imageUrl: input.imageUrl,
      notes: input.notes,
      items: input.items,
      tagIds: input.tagIds,
      ocrStatus: input.ocrStatus,
      ocrError: input.ocrError,
      isApproved: input.isApproved,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : undefined,
    });
  }
  // #endregion

  // #region Delete
  async deleteReceipt(id: string, familyId: string) {
    const existing = await this.receiptActions.findReceiptById(id, familyId);
    if (!existing) throw new NotFoundException('Receipt not found');

    await this.receiptActions.deleteReceipt(id, familyId);
  }
  // #endregion

  // #region Misc
  async createExpenseFromReceipt(id: string, familyId: string) {
    const receipt = await this.receiptActions.findReceiptById(id, familyId);
    if (!receipt) throw new NotFoundException('Receipt not found');

    if ((receipt as any).ocrStatus === 'PENDING') {
      throw new BadRequestException('Paragon jest jeszcze przetwarzany. Poczekaj na zakończenie OCR.');
    }

    if ((receipt as any).isApproved) {
      throw new BadRequestException('Paragon został już zatwierdzony.');
    }

    if (Number((receipt as any).amount ?? 0) <= 0) {
      throw new BadRequestException('Uzupełnij kwotę paragonu przed zatwierdzeniem.');
    }

    await this._autoCreateExpense(familyId, receipt);
    await this.receiptActions.updateReceipt(id, familyId, {
      isApproved: true,
      approvedAt: new Date(),
    });

    return { message: 'Receipt approved and expense created' };
  }
  // #endregion
}
