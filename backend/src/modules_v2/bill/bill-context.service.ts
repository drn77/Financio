import { Injectable, NotFoundException } from '@nestjs/common';
import { BillActionsService } from './bill-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PayBillDto } from './dto/pay-bill.dto';

@Injectable()
export class BillContextService {
  constructor(
    private readonly billActions: BillActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
  ) {}

  // #region Private
  private _extractTemplateColumns(templateColumns: any): { id: string; type?: string; tagGroupId?: string }[] {
    return Array.isArray(templateColumns)
      ? templateColumns.filter((c: any) => c && typeof c.id === 'string')
      : [];
  }

  private _buildAutoExpenseData(
    templateColumnsRaw: any,
    bill: any,
    payment: { id: string },
    input: PayBillDto,
  ): Record<string, any> {
    const columns = this._extractTemplateColumns(templateColumnsRaw);
    const data: Record<string, any> = {
      col_date: new Date().toISOString().split('T')[0],
      col_amount: { amount: input.amount, currency: (bill as any).currency ?? 'PLN' },
      col_description: bill.name,
      col_paid: true,
      _billId: bill.id,
      _billPaymentId: payment.id,
      _billPaymentDueDate: new Date(input.dueDate).toISOString().split('T')[0],
      _billName: bill.name,
    };

    const tagGroupColumns = columns.filter((c) => c.type === 'tag_group' && typeof c.tagGroupId === 'string');
    const billTags = Array.isArray((bill as any)?.tags) ? (bill as any).tags : [];

    for (const column of tagGroupColumns) {
      const selectedTagNames = billTags
        .filter((bt: any) => bt?.tag?.tagGroupId === column.tagGroupId)
        .map((bt: any) => bt?.tag?.name)
        .filter((name: any) => typeof name === 'string');

      data[column.id] = selectedTagNames;
    }

    return data;
  }

  private _computeNextDueDate(dueDay: number, frequency: string): Date {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);

    if (currentMonth >= now) {
      return currentMonth;
    }

    switch (frequency) {
      case 'QUARTERLY':
        return new Date(now.getFullYear(), now.getMonth() + 3, dueDay);
      case 'YEARLY':
        return new Date(now.getFullYear() + 1, now.getMonth(), dueDay);
      default:
        return new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
  }

  private _getPaidAmountForCurrentMonth(payments: { amount: any; dueDate: Date; paidAt: Date }[]): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return payments
      .filter((p) => new Date(p.dueDate) >= monthStart && new Date(p.dueDate) <= monthEnd)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  private _computeStatus(dueDay: number, paidAmount: number, billAmount: number): string {
    if (paidAmount >= billAmount) return 'PAID';

    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (paidAmount > 0) return 'PARTIALLY_PAID';
    if (daysUntilDue < 0) return 'OVERDUE';
    if (daysUntilDue === 0) return 'DUE_TODAY';

    return 'UPCOMING';
  }

  private _normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private _computeReferenceDueDate(dueDay: number, startDate: Date, now: Date): Date {
    const dueInCurrentMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (this._normalizeDate(dueInCurrentMonth) >= this._normalizeDate(startDate)) {
      return dueInCurrentMonth;
    }

    const startMonthDue = new Date(startDate.getFullYear(), startDate.getMonth(), dueDay);
    if (this._normalizeDate(startMonthDue) >= this._normalizeDate(startDate)) {
      return startMonthDue;
    }

    return new Date(startDate.getFullYear(), startDate.getMonth() + 1, dueDay);
  }

  private _mapTag(tag: any) {
    if (!tag) return null;
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      groupName: tag.tagGroup?.name ?? null,
    };
  }

  private _resolveTransitionTag(
    bill: any,
    paidAmount: number,
    billAmount: number,
    referenceDueDate: Date,
  ) {
    const beforeTag = this._mapTag(bill.tagBeforePayment);
    const afterTag = this._mapTag(bill.tagAfterPayment);
    if (!beforeTag && !afterTag) return null;

    if (paidAmount >= billAmount) {
      return afterTag;
    }

    const now = new Date();
    const daysUntilDue = Math.ceil((referenceDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= Number(bill.reminderDays ?? 0)) {
      return beforeTag;
    }

    return afterTag;
  }

  private _computePaymentStats(payments: { amount: any; dueDate: Date; paidAt: Date }[]) {
    if (payments.length === 0) {
      return { averageAmount: 0, lastPaymentDate: null, totalPaid: 0, paymentCount: 0 };
    }

    const amounts = payments.map((p) => Number(p.amount));
    const totalPaid = amounts.reduce((sum, a) => sum + a, 0);

    return {
      averageAmount: Math.round((totalPaid / amounts.length) * 100) / 100,
      lastPaymentDate: payments[0]?.paidAt ?? null,
      totalPaid: Math.round(totalPaid * 100) / 100,
      paymentCount: payments.length,
    };
  }

  private _mapBill(bill: any) {
    const { categoryId: _unusedCategoryId, ...billWithoutCategory } = bill;
    const billAmount = Number(bill.amount);
    const paidAmount = this._getPaidAmountForCurrentMonth(bill.payments);
    const isPaidThisMonth = paidAmount >= billAmount;
    const paymentStats = this._computePaymentStats(bill.payments);
    const startDate = bill.paymentStartDate ? new Date(bill.paymentStartDate) : new Date();
    const endDate = bill.paymentEndDate ? new Date(bill.paymentEndDate) : null;
    const referenceDueDate = this._computeReferenceDueDate(bill.dueDay, startDate, new Date());
    const inPaymentWindow = this._normalizeDate(new Date()) >= this._normalizeDate(startDate)
      && (!endDate || this._normalizeDate(new Date()) <= this._normalizeDate(endDate));

    const mappedTags = (bill.tags ?? []).map((bt: any) => ({
      id: bt.tag.id,
      name: bt.tag.name,
      color: bt.tag.color,
      icon: bt.tag.icon,
      groupName: bt.tag.tagGroup?.name ?? null,
    }));

    const transitionTag = inPaymentWindow
      ? this._resolveTransitionTag(bill, paidAmount, billAmount, referenceDueDate)
      : null;

    if (transitionTag && !mappedTags.some((tag: { id: string }) => tag.id === transitionTag.id)) {
      mappedTags.push(transitionTag);
    }

    const status = !inPaymentWindow
      ? 'UPCOMING'
      : this._computeStatus(referenceDueDate.getDate(), paidAmount, billAmount);

    return {
      ...billWithoutCategory,
      amount: billAmount,
      budgetLimit: bill.budgetLimit ? Number(bill.budgetLimit) : null,
      payments: bill.payments.map((p: any) => ({
        ...p,
        amount: Number(p.amount),
      })),
      tags: mappedTags,
      tagBeforePayment: this._mapTag(bill.tagBeforePayment),
      tagAfterPayment: this._mapTag(bill.tagAfterPayment),
      nextDueDate: this._computeNextDueDate(referenceDueDate.getDate(), bill.frequency),
      isPaidThisMonth,
      paidAmount: Math.round(paidAmount * 100) / 100,
      remainingAmount: Math.round(Math.max(billAmount - paidAmount, 0) * 100) / 100,
      status,
      paymentStats,
    };
  }
  // #endregion

  // #region Create
  async createBill(familyId: string, input: CreateBillDto) {
    const bill = await this.billActions.createBill({
      familyId,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      dueDay: input.dueDay,
      paymentStartDate: new Date(input.paymentStartDate),
      paymentEndDate: input.paymentEndDate ? new Date(input.paymentEndDate) : null,
      frequency: input.frequency,
      notes: input.notes,
      paymentType: input.paymentType,
      autoCreateExpense: input.autoCreateExpense,
      reminderDays: input.reminderDays,
      budgetLimit: input.budgetLimit,
      tagBeforePaymentId: input.tagBeforePaymentId,
      tagAfterPaymentId: input.tagAfterPaymentId,
      tagIds: input.tagIds,
    });

    return this._mapBill(bill);
  }

  async payBill(billId: string, familyId: string, input: PayBillDto) {
    const bill = await this.billActions.findBillById(billId, familyId);

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const payment = await this.billActions.createBillPayment({
      billId,
      amount: input.amount,
      dueDate: new Date(input.dueDate),
      notes: input.notes,
    });

    // Auto-create expense record if enabled
    if (bill.autoCreateExpense) {
      try {
        const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);

        if (defaultTemplate) {
          const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
          const autoExpenseData = this._buildAutoExpenseData(defaultTemplate.columns, bill, payment, input);

          await this.recordActions.createRecord({
            templateId: defaultTemplate.id,
            data: autoExpenseData,
            sortOrder: maxSort + 1,
          });
        }
      } catch (e) {
        // Don't fail the payment if auto-expense creation fails
        console.error('Auto-expense creation failed:', e);
      }
    }

    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }
  // #endregion

  // #region Read
  async getBills(familyId: string, active?: boolean) {
    const bills = await this.billActions.findBillsByFamily(familyId, active);

    return bills.map((bill: any) => this._mapBill(bill));
  }

  async getBill(id: string, familyId: string) {
    const bill = await this.billActions.findBillById(id, familyId);

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this._mapBill(bill);
  }

  async getBillPayments(billId: string, familyId: string) {
    const bill = await this.billActions.findBillById(billId, familyId);

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const payments = await this.billActions.findBillPayments(billId);

    return payments.map((p: any) => ({
      ...p,
      amount: Number(p.amount),
    }));
  }

  async getBillStats(familyId: string) {
    return this.billActions.getBillStats(familyId);
  }
  // #endregion

  // #region Update
  async updateBill(id: string, familyId: string, input: UpdateBillDto) {
    const existing = await this.billActions.findBillById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Bill not found');
    }

    if (input.tagIds !== undefined) {
      await this.billActions.replaceBillTags(id, input.tagIds);
    }

    const bill = await this.billActions.updateBill(id, familyId, {
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      dueDay: input.dueDay,
      paymentStartDate: input.paymentStartDate ? new Date(input.paymentStartDate) : undefined,
      paymentEndDate: input.paymentEndDate !== undefined
        ? (input.paymentEndDate ? new Date(input.paymentEndDate) : null)
        : undefined,
      frequency: input.frequency,
      notes: input.notes,
      isActive: input.isActive,
      paymentType: input.paymentType,
      autoCreateExpense: input.autoCreateExpense,
      reminderDays: input.reminderDays,
      budgetLimit: input.budgetLimit,
      tagBeforePaymentId: input.tagBeforePaymentId !== undefined ? input.tagBeforePaymentId || null : undefined,
      tagAfterPaymentId: input.tagAfterPaymentId !== undefined ? input.tagAfterPaymentId || null : undefined,
    });

    return this._mapBill(bill);
  }
  // #endregion

  // #region Delete
  async deleteBill(id: string, familyId: string) {
    const existing = await this.billActions.findBillById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Bill not found');
    }

    await this.billActions.deleteBill(id, familyId);

    return;
  }

  async deleteBillPayment(paymentId: string, billId: string, familyId: string) {
    const bill = await this.billActions.findBillById(billId, familyId);

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const payment = await this.billActions.findBillPaymentById(paymentId, billId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Remove auto-created expense record linked to this bill payment (new linkage path).
    const removedByPaymentId = await this.recordActions.deleteAutoExpenseRecordsByBillPaymentId(
      familyId,
      paymentId,
    );

    // Backward compatibility for older auto-created records that predate _billPaymentId linkage.
    if (removedByPaymentId === 0) {
      const paymentDate = new Date(payment.paidAt).toISOString().split('T')[0];
      const fallbackCandidates = await this.recordActions.findAutoExpenseRecordCandidates(
        familyId,
        billId,
        Number(payment.amount),
        paymentDate,
      );

      if (fallbackCandidates.length > 0) {
        await this.recordActions.deleteRecord(fallbackCandidates[0].id);
      }
    }

    await this.billActions.deleteBillPayment(paymentId, billId);

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
