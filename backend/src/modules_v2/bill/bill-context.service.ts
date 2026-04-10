import { Injectable, NotFoundException } from '@nestjs/common';
import { BillActionsService } from './bill-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { SavingsActionsService } from '../savings/savings-actions.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PayBillDto } from './dto/pay-bill.dto';
import {
  calculatePeriodBoundaries,
  type IBillingPeriodConfig,
} from '../../shared/billing-period/billing-period.utils';

@Injectable()
export class BillContextService {
  constructor(
    private readonly billActions: BillActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
    private readonly savingsActions: SavingsActionsService,
    private readonly prisma: PrismaService,
  ) {}

  // #region Private
  private _extractTemplateColumns(templateColumns: any): { id: string; type?: string; tagGroupId?: string }[] {
    return Array.isArray(templateColumns)
      ? templateColumns.filter((c: any) => c && typeof c.id === 'string')
      : [];
  }

  private async _loadBillFieldConfigs(familyId: string): Promise<Record<string, any>> {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { dashboardConfig: true },
    });
    const dc = (family?.dashboardConfig as any) ?? {};
    return dc?.expenseMappings?.bills?.fieldConfigs ?? {};
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

  private _toIsoDate(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }

  private _clampDay(year: number, month: number, day: number): Date {
    const maxDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(Math.max(day, 1), maxDay));
  }

  private _addBillFrequency(date: Date, frequency: string, dueDay: number): Date {
    switch (frequency) {
      case 'DAILY':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      case 'WEEKLY':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
      case 'QUARTERLY':
        return this._clampDay(date.getFullYear(), date.getMonth() + 3, dueDay);
      case 'YEARLY':
        return this._clampDay(date.getFullYear() + 1, date.getMonth(), dueDay);
      case 'MONTHLY':
      default:
        return this._clampDay(date.getFullYear(), date.getMonth() + 1, dueDay);
    }
  }

  private _resolveInitialOccurrenceDate(bill: any): Date {
    const startDate = new Date(bill.paymentStartDate);
    const frequency = String(bill.frequency ?? 'MONTHLY');

    if (frequency === 'DAILY' || frequency === 'WEEKLY') {
      return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    }

    let occurrence = this._clampDay(startDate.getFullYear(), startDate.getMonth(), bill.dueDay);
    while (occurrence < startDate) {
      occurrence = this._addBillFrequency(occurrence, frequency, bill.dueDay);
    }

    return occurrence;
  }

  private _getOccurrencesInRange(bill: any, rangeStart: Date, rangeEnd: Date): Date[] {
    const startDate = new Date(bill.paymentStartDate);
    const endDate = bill.paymentEndDate ? new Date(bill.paymentEndDate) : null;
    const occurrences: Date[] = [];

    let occurrence = this._resolveInitialOccurrenceDate(bill);
    while (occurrence < rangeStart) {
      occurrence = this._addBillFrequency(occurrence, String(bill.frequency ?? 'MONTHLY'), bill.dueDay);
    }

    while (occurrence < rangeEnd) {
      if (occurrence >= startDate && (!endDate || occurrence <= endDate)) {
        occurrences.push(occurrence);
      }
      occurrence = this._addBillFrequency(occurrence, String(bill.frequency ?? 'MONTHLY'), bill.dueDay);
    }

    return occurrences;
  }

  private _getPaymentsForOccurrence(payments: Array<{ dueDate: Date; paidAt: Date; amount: any; id: string }>, occurrenceDateIso: string) {
    return payments.filter((payment) => this._toIsoDate(new Date(payment.dueDate)) === occurrenceDateIso);
  }

  private _applyTransitionTagToData(
    data: Record<string, any>,
    columns: { id: string; type?: string; tagGroupId?: string }[],
    activeTag: any,
    inactiveTag: any,
  ) {
    const tagGroupId = activeTag?.tagGroupId ?? inactiveTag?.tagGroupId;
    if (!tagGroupId) return;

    const targetColumn = columns.find((column) => column.type === 'tag_group' && column.tagGroupId === tagGroupId);
    if (!targetColumn) return;

    const existingNames = Array.isArray(data[targetColumn.id])
      ? data[targetColumn.id].map((value: any) => String(value)).filter(Boolean)
      : data[targetColumn.id]
        ? [String(data[targetColumn.id])]
        : [];

    const nextNames = existingNames.filter((name: string) => name !== inactiveTag?.name);
    if (activeTag?.name && !nextNames.includes(activeTag.name)) {
      nextNames.push(activeTag.name);
    }

    if (nextNames.length > 0) {
      data[targetColumn.id] = nextNames;
    }
  }

  private async _resolveCurrentAutoExpenseContext(familyId: string) {
    const template = await this.templateActions.findDefaultTemplate(familyId);
    if (!template) return null;

    const now = new Date();
    const billingPeriod = (template.billingPeriod as IBillingPeriodConfig | null) ?? null;
    if (billingPeriod?.type) {
      const { periodStart, periodEnd } = calculatePeriodBoundaries(billingPeriod, now);
      const override = await this.prisma.billingPeriodOverride.findUnique({
        where: {
          templateId_periodStart: {
            templateId: template.id,
            periodStart,
          },
        },
      });

      return {
        template,
        rangeStart: periodStart,
        rangeEnd: override?.overrideResetDate ?? periodEnd,
      };
    }

    return {
      template,
      rangeStart: new Date(now.getFullYear(), now.getMonth(), 1),
      rangeEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }

  private async _buildAutoExpenseData(
    familyId: string,
    templateColumnsRaw: any,
    bill: any,
    options: {
      occurrenceDate: Date;
      amount: number;
      paid: boolean;
      paymentId?: string | null;
    },
  ): Promise<Record<string, any>> {
    const columns = this._extractTemplateColumns(templateColumnsRaw);
    const fieldConfigs = await this._loadBillFieldConfigs(familyId);
    const hasConfig = Object.keys(fieldConfigs).length > 0;
    const occurrenceDateIso = this._toIsoDate(options.occurrenceDate);

    // Bill source values
    const sourceValues: Record<string, any> = {
      name: bill.name,
      amount: { amount: options.amount, currency: (bill as any).currency ?? 'PLN' },
      paymentDate: occurrenceDateIso,
      notes: bill.notes ?? '',
    };

    // Metadata always included
    const data: Record<string, any> = {
      _billId: bill.id,
      _billPaymentId: options.paymentId ?? null,
      _billPaymentDueDate: occurrenceDateIso,
      _billOccurrenceDate: occurrenceDateIso,
      _billName: bill.name,
    };

    if (hasConfig) {
      // Config-driven mapping
      const autoTagIdPool = new Set<string>();

      for (const column of columns) {
        const columnId = String(column.id);
        const cfg = fieldConfigs[columnId];
        if (!cfg || cfg.mode === 'none') continue;

        if (cfg.mode === 'auto_tags' && column.type === 'tag_group') {
          for (const tagId of cfg.autoTagIds ?? []) autoTagIdPool.add(tagId);
          continue;
        }

        if (cfg.mode === 'select' && column.type === 'tag_group') {
          // User-selected tag from the bill's tagIds – find matching tag for this group
          const billTags = Array.isArray(bill.tags) ? bill.tags : [];
          const names = billTags
            .filter((bt: any) => bt?.tag?.tagGroupId === column.tagGroupId)
            .map((bt: any) => bt?.tag?.name)
            .filter(Boolean);
          if (names.length > 0) data[columnId] = names;
          continue;
        }

        if (cfg.mode === 'map' && cfg.sourceField) {
          if (cfg.sourceField === 'tags') {
            // Special: fill from bill tags for this tag_group column
            const billTags = Array.isArray(bill.tags) ? bill.tags : [];
            const names = billTags
              .filter((bt: any) => !column.tagGroupId || bt?.tag?.tagGroupId === column.tagGroupId)
              .map((bt: any) => bt?.tag?.name)
              .filter(Boolean);
            if (names.length > 0) data[columnId] = names;
          } else {
            const value = sourceValues[cfg.sourceField];
            if (value != null) data[columnId] = value;
          }
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

      // Always keep the payment state in sync with the bill occurrence.
      const paidCol = columns.find((c: any) => c.type === 'checkbox' && /paid|oplac|zaplac|rozlicz/i.test(String(c.id ?? '') + ' ' + String(c.name ?? '')));
      if (paidCol) data[paidCol.id] = options.paid;
      else data.col_paid = options.paid;
    } else {
      // Legacy hardcoded mapping (backward compat)
      data.col_date = occurrenceDateIso;
      data.col_amount = sourceValues.amount;
      data.col_description = bill.name;
      data.col_paid = options.paid;

      const tagGroupColumns = columns.filter((c) => c.type === 'tag_group' && typeof c.tagGroupId === 'string');
      const billTags = Array.isArray(bill.tags) ? bill.tags : [];
      for (const column of tagGroupColumns) {
        const selectedTagNames = billTags
          .filter((bt: any) => bt?.tag?.tagGroupId === column.tagGroupId)
          .map((bt: any) => bt?.tag?.name)
          .filter((name: any) => typeof name === 'string');
        data[column.id] = selectedTagNames;
      }
    }

    this._applyTransitionTagToData(
      data,
      columns,
      options.paid ? bill.tagAfterPayment : bill.tagBeforePayment,
      options.paid ? bill.tagBeforePayment : bill.tagAfterPayment,
    );

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
      savingsGoalId: bill.savingsGoalId ?? null,
      savingsGoal: bill.savingsGoal ? { id: bill.savingsGoal.id, name: bill.savingsGoal.name } : null,
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
      savingsGoalId: input.savingsGoalId,
      tagIds: input.tagIds,
    });

    if (bill.autoCreateExpense) {
      try {
        await this.syncAutoExpensesForCurrentPeriod(familyId);
      } catch (error) {
        console.error('Recurring expense sync after bill creation failed:', error);
      }
    }

    return this._mapBill(bill);
  }

  async payBill(billId: string, familyId: string, userId: string, input: PayBillDto) {
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
          const occurrenceDate = new Date(input.dueDate);
          const occurrenceDateIso = this._toIsoDate(occurrenceDate);
          const occurrencePayments = [
            ...this._getPaymentsForOccurrence(bill.payments ?? [], occurrenceDateIso),
            payment,
          ];
          const paidAmount = occurrencePayments.reduce((sum, currentPayment) => sum + Number(currentPayment.amount), 0);
          const autoExpenseData = await this._buildAutoExpenseData(familyId, defaultTemplate.columns, bill, {
            occurrenceDate,
            amount: Number(bill.amount),
            paid: paidAmount >= Number(bill.amount),
            paymentId: payment.id,
          });
          const existingRecord = await this.recordActions.findBillAutoExpenseRecordByOccurrence(
            defaultTemplate.id,
            bill.id,
            occurrenceDateIso,
          );

          if (existingRecord) {
            const existingData = (existingRecord.data as Record<string, any>) ?? {};
            await this.recordActions.updateRecord(existingRecord.id, {
              data: {
                ...existingData,
                ...autoExpenseData,
              },
            });
          } else {
            const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
            await this.recordActions.createRecord({
              templateId: defaultTemplate.id,
              data: autoExpenseData,
              sortOrder: maxSort + 1,
            });
          }
        }
      } catch (e) {
        // Don't fail the payment if auto-expense creation fails
        console.error('Auto-expense creation failed:', e);
      }
    }

    // Auto-create savings deposit if bill is linked to a savings goal
    if (bill.savingsGoalId) {
      try {
        await this.savingsActions.createDeposit({
          goalId: bill.savingsGoalId,
          userId,
          amount: input.amount,
          date: new Date(input.dueDate),
          notes: `Cykliczny wydatek: ${bill.name}`,
        });
      } catch (e) {
        console.error('Savings deposit creation from bill payment failed:', e);
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

  async syncAutoExpensesForCurrentPeriod(familyId: string) {
    const context = await this._resolveCurrentAutoExpenseContext(familyId);
    if (!context) {
      return { created: 0, updated: 0 };
    }

    const bills = (await this.billActions.findBillsByFamily(familyId, true)).filter((bill: any) => bill.autoCreateExpense);
    if (bills.length === 0) {
      return { created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;
    let nextSortOrder = await this.recordActions.getMaxSortOrder(context.template.id);

    for (const bill of bills) {
      const occurrences = this._getOccurrencesInRange(bill, context.rangeStart, context.rangeEnd);
      for (const occurrenceDate of occurrences) {
        const occurrenceDateIso = this._toIsoDate(occurrenceDate);
        const occurrencePayments = this._getPaymentsForOccurrence(bill.payments ?? [], occurrenceDateIso);
        const latestPayment = occurrencePayments[0] ?? null;
        const paidAmount = occurrencePayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const autoExpenseData = await this._buildAutoExpenseData(familyId, context.template.columns, bill, {
          occurrenceDate,
          amount: Number(bill.amount),
          paid: occurrencePayments.length > 0 && paidAmount >= Number(bill.amount),
          paymentId: latestPayment?.id ?? null,
        });

        const existingRecord = await this.recordActions.findBillAutoExpenseRecordByOccurrence(
          context.template.id,
          bill.id,
          occurrenceDateIso,
        );

        if (existingRecord) {
          const existingData = (existingRecord.data as Record<string, any>) ?? {};
          const nextData = {
            ...existingData,
            ...autoExpenseData,
          };

          if (JSON.stringify(existingData) !== JSON.stringify(nextData)) {
            await this.recordActions.updateRecord(existingRecord.id, { data: nextData });
            updated += 1;
          }
          continue;
        }

        nextSortOrder += 1;
        await this.recordActions.createRecord({
          templateId: context.template.id,
          data: autoExpenseData,
          sortOrder: nextSortOrder,
        });
        created += 1;
      }
    }

    return { created, updated };
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
      savingsGoalId: input.savingsGoalId !== undefined ? input.savingsGoalId || null : undefined,
    });

    if ((bill as any).autoCreateExpense) {
      try {
        await this.syncAutoExpensesForCurrentPeriod(familyId);
      } catch (error) {
        console.error('Recurring expense sync after bill update failed:', error);
      }
    }

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

    const occurrenceDate = new Date(payment.dueDate);
    const occurrenceDateIso = this._toIsoDate(occurrenceDate);

    await this.billActions.deleteBillPayment(paymentId, billId);

    if (bill.autoCreateExpense) {
      try {
        const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
        const refreshedBill = await this.billActions.findBillById(billId, familyId);

        if (defaultTemplate && refreshedBill) {
          const occurrencePayments = this._getPaymentsForOccurrence(refreshedBill.payments ?? [], occurrenceDateIso);
          const latestPayment = occurrencePayments[0] ?? null;
          const paidAmount = occurrencePayments.reduce((sum, currentPayment) => sum + Number(currentPayment.amount), 0);
          const autoExpenseData = await this._buildAutoExpenseData(familyId, defaultTemplate.columns, refreshedBill, {
            occurrenceDate,
            amount: Number(refreshedBill.amount),
            paid: occurrencePayments.length > 0 && paidAmount >= Number(refreshedBill.amount),
            paymentId: latestPayment?.id ?? null,
          });
          const existingRecord = await this.recordActions.findBillAutoExpenseRecordByOccurrence(
            defaultTemplate.id,
            billId,
            occurrenceDateIso,
          );

          if (existingRecord) {
            const existingData = (existingRecord.data as Record<string, any>) ?? {};
            await this.recordActions.updateRecord(existingRecord.id, {
              data: {
                ...existingData,
                ...autoExpenseData,
              },
            });
          } else {
            const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
            await this.recordActions.createRecord({
              templateId: defaultTemplate.id,
              data: autoExpenseData,
              sortOrder: maxSort + 1,
            });
          }

          return;
        }
      } catch (e) {
        console.error('Bill auto-expense re-sync after deleting payment failed:', e);
      }
    }

    // Remove legacy auto-created expense record linked to this payment.
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

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
