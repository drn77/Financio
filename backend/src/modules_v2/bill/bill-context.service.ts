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
    const billAmount = Number(bill.amount);
    const paidAmount = this._getPaidAmountForCurrentMonth(bill.payments);
    const isPaidThisMonth = paidAmount >= billAmount;
    const paymentStats = this._computePaymentStats(bill.payments);

    return {
      ...bill,
      amount: billAmount,
      budgetLimit: bill.budgetLimit ? Number(bill.budgetLimit) : null,
      payments: bill.payments.map((p: any) => ({
        ...p,
        amount: Number(p.amount),
      })),
      tags: (bill.tags ?? []).map((bt: any) => ({
        id: bt.tag.id,
        name: bt.tag.name,
        color: bt.tag.color,
        icon: bt.tag.icon,
        groupName: bt.tag.tagGroup?.name ?? null,
      })),
      nextDueDate: this._computeNextDueDate(bill.dueDay, bill.frequency),
      isPaidThisMonth,
      paidAmount: Math.round(paidAmount * 100) / 100,
      remainingAmount: Math.round(Math.max(billAmount - paidAmount, 0) * 100) / 100,
      status: this._computeStatus(bill.dueDay, paidAmount, billAmount),
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
      frequency: input.frequency,
      categoryId: input.categoryId,
      notes: input.notes,
      paymentType: input.paymentType,
      autoCreateExpense: input.autoCreateExpense,
      reminderDays: input.reminderDays,
      budgetLimit: input.budgetLimit,
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
          const categoryName = (bill as any).category?.name ?? '';

          await this.recordActions.createRecord({
            templateId: defaultTemplate.id,
            data: {
              col_date: new Date().toISOString().split('T')[0],
              col_type: 'Wydatek',
              col_category: categoryName ? [categoryName] : [],
              col_amount: { amount: input.amount, currency: (bill as any).currency ?? 'PLN' },
              col_person: '',
              col_paid: true,
              _billId: billId,
              _billName: bill.name,
            },
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
      frequency: input.frequency,
      categoryId: input.categoryId,
      notes: input.notes,
      isActive: input.isActive,
      paymentType: input.paymentType,
      autoCreateExpense: input.autoCreateExpense,
      reminderDays: input.reminderDays,
      budgetLimit: input.budgetLimit,
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

    await this.billActions.deleteBillPayment(paymentId, billId);

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
