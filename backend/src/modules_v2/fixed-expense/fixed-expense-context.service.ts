import { Injectable, NotFoundException } from '@nestjs/common';
import { FixedExpenseActionsService } from './fixed-expense-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateFixedExpenseDto } from './dto/create-fixed-expense.dto';
import { UpdateFixedExpenseDto } from './dto/update-fixed-expense.dto';
import { PayFixedExpenseDto } from './dto/pay-fixed-expense.dto';

@Injectable()
export class FixedExpenseContextService {
  constructor(
    private readonly fixedExpenseActions: FixedExpenseActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
    private readonly prisma: PrismaService,
  ) {}

  // #region Private
  private _toIsoDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private _clampDay(year: number, month: number, day: number): Date {
    const max = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(Math.max(day, 1), max);
    return new Date(year, month, safeDay);
  }

  private _computeNextDueDate(from: Date, frequency: string, dayOfMonth?: number | null): Date {
    const base = new Date(from);
    const targetDay = dayOfMonth ?? base.getDate();

    switch (frequency) {
      case 'DAILY':
        return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
      case 'WEEKLY':
        return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
      case 'QUARTERLY': {
        const month = base.getMonth() + 3;
        return this._clampDay(base.getFullYear(), month, targetDay);
      }
      case 'YEARLY':
        return this._clampDay(base.getFullYear() + 1, base.getMonth(), targetDay);
      case 'MONTHLY':
      default: {
        const month = base.getMonth() + 1;
        return this._clampDay(base.getFullYear(), month, targetDay);
      }
    }
  }

  private _resolveInitialDueDate(startDate: Date, frequency?: string, dayOfMonth?: number): Date {
    if ((frequency ?? 'MONTHLY') === 'MONTHLY' && dayOfMonth) {
      return this._clampDay(startDate.getFullYear(), startDate.getMonth(), dayOfMonth);
    }
    return startDate;
  }

  private async _buildTagIdToNameMap(familyId: string, tagIds: string[]): Promise<Record<string, string>> {
    if (!tagIds.length) return {};

    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, tagGroup: { familyId } },
      select: { id: true, name: true },
    });

    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.name;
    }
    return map;
  }

  private async _loadFixedExpenseFieldConfigs(familyId: string): Promise<Record<string, any>> {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { dashboardConfig: true },
    });
    const dc = (family?.dashboardConfig as any) ?? {};
    // Fixed expenses share the 'bills' config since they're the same concept
    return dc?.expenseMappings?.bills?.fieldConfigs ?? {};
  }

  private _extractAmount(colAmount: any): number {
    if (!colAmount) return 0;
    if (typeof colAmount === 'number') return colAmount;
    if (typeof colAmount === 'object' && colAmount.amount) return Number(colAmount.amount);
    return 0;
  }
  // #endregion

  // #region Create
  async createFixedExpense(familyId: string, input: CreateFixedExpenseDto) {
    const startDate = new Date(input.startDate);
    const expense = await this.fixedExpenseActions.createFixedExpense({
      familyId,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth,
      startDate,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      nextDueDate: input.nextDueDate
        ? new Date(input.nextDueDate)
        : this._resolveInitialDueDate(startDate, input.frequency, input.dayOfMonth),
      categoryId: input.categoryId,
      personId: input.personId,
      paymentTagId: input.paymentTagId,
      paymentTemplateData: input.paymentTemplateData,
      notes: input.notes,
    });

    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }
  // #endregion

  // #region Read
  async getFixedExpenses(familyId: string) {
    const expenses = await this.fixedExpenseActions.findFixedExpensesByFamily(familyId);

    return expenses.map((e: any) => ({
      ...e,
      amount: Number(e.amount),
    }));
  }

  async getFixedExpense(id: string, familyId: string) {
    const expense = await this.fixedExpenseActions.findFixedExpenseById(id, familyId);

    if (!expense) {
      throw new NotFoundException('Fixed expense not found');
    }

    return {
      ...expense,
      amount: Number((expense as any).amount ?? 0),
    };
  }
  // #endregion

  // #region Update
  async updateFixedExpense(id: string, familyId: string, input: UpdateFixedExpenseDto) {
    const existing = await this.fixedExpenseActions.findFixedExpenseById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Fixed expense not found');
    }

    const expense = await this.fixedExpenseActions.updateFixedExpense(id, familyId, {
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : undefined,
      categoryId: input.categoryId,
      personId: input.personId,
      paymentTagId: input.paymentTagId,
      paymentTemplateData: input.paymentTemplateData,
      notes: input.notes,
      isActive: input.isActive,
    });

    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }

  async payFixedExpense(id: string, familyId: string, input: PayFixedExpenseDto) {
    const expense = await this.fixedExpenseActions.findFixedExpenseById(id, familyId);

    if (!expense) {
      throw new NotFoundException('Fixed expense not found');
    }

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    const amount = input.amount ?? Number(expense.amount);

    try {
      const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
      if (defaultTemplate) {
        const columns = (defaultTemplate.columns as any[]) ?? [];
        const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
        const fieldConfigs = await this._loadFixedExpenseFieldConfigs(familyId);
        const hasConfig = Object.keys(fieldConfigs).length > 0;

        const category = expense.categoryId
          ? await this.prisma.category.findFirst({ where: { id: expense.categoryId, familyId }, select: { name: true } })
          : null;

        const person = expense.personId
          ? await this.prisma.familyMember.findFirst({
              where: { id: expense.personId, familyId },
              include: { user: { select: { firstName: true, username: true } } },
            })
          : null;

        // Source values
        const sourceValues: Record<string, any> = {
          name: expense.name,
          amount: { amount, currency: (expense as any).currency ?? 'PLN' },
          paidAt: this._toIsoDate(paidAt),
          category: category?.name ? [category.name] : [],
          person: person?.user?.firstName ?? person?.user?.username ?? '',
          notes: (expense as any).notes ?? '',
        };

        // Metadata always included
        const data: Record<string, any> = {
          _fixedExpenseId: expense.id,
          _fixedExpenseName: expense.name,
        };

        if (hasConfig) {
          // Config-driven mapping
          const autoTagIdPool = new Set<string>();
          for (const column of columns) {
            const columnId = String(column?.id ?? '');
            if (!columnId) continue;
            const cfg = fieldConfigs[columnId];
            if (!cfg || cfg.mode === 'none') continue;

            if (cfg.mode === 'auto_tags' && column?.type === 'tag_group') {
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
              const cfg = fieldConfigs[column?.id];
              if (!cfg || cfg.mode !== 'auto_tags' || column?.type !== 'tag_group') continue;
              const names = (cfg.autoTagIds ?? []).map((id: string) => tagNameMap[id]).filter(Boolean);
              if (names.length > 0) data[column.id] = names;
            }
          }
          // Always mark paid
          const paidCol = columns.find((c: any) => c?.type === 'checkbox' && /paid|oplac|zaplac|rozlicz/i.test(String(c?.id ?? '') + ' ' + String(c?.name ?? '')));
          if (paidCol) data[paidCol.id] = true;
          else data.col_paid = true;
        } else {
          // Legacy hardcoded mapping
          data.col_date = this._toIsoDate(paidAt);
          data.col_amount = sourceValues.amount;
          data.col_paid = true;
          data.col_category = category?.name ? [category.name] : [];
          data.col_person = person?.user?.firstName ?? person?.user?.username ?? '';
        }

        // Merge per-item paymentTemplateData + overrides
        Object.assign(data,
          typeof (expense as any).paymentTemplateData === 'object' && (expense as any).paymentTemplateData
            ? (expense as any).paymentTemplateData as Record<string, unknown>
            : {},
          input.overrideTemplateData ?? {},
        );

        // paymentTagId override (per-item tag)
        const configuredTagId = (expense as any).paymentTagId as string | undefined;
        if (configuredTagId) {
          const map = await this._buildTagIdToNameMap(familyId, [configuredTagId]);
          const tagName = map[configuredTagId];
          if (tagName) {
            const tagGroupColumn = columns.find((c: any) => c.type === 'tag_group');
            if (tagGroupColumn) {
              data[tagGroupColumn.id] = tagName;
            }
          }
        }

        await this.recordActions.createRecord({
          templateId: defaultTemplate.id,
          data,
          sortOrder: maxSort + 1,
        });
      }
    } catch (e) {
      // Payment update should not fail if record creation fails.
      console.error('Fixed expense payment record creation failed:', e);
    }

    const previousDue = (expense as any).nextDueDate ? new Date((expense as any).nextDueDate) : paidAt;
    const nextDueDate = this._computeNextDueDate(previousDue, (expense as any).frequency, (expense as any).dayOfMonth);

    const updated = await this.fixedExpenseActions.updateFixedExpense(id, familyId, {
      lastPaidAt: paidAt,
      nextDueDate,
    } as any);

    return {
      ...updated,
      amount: Number(updated.amount),
      paidAt,
    };
  }
  // #endregion

  // #region Delete
  async deleteFixedExpense(id: string, familyId: string) {
    const existing = await this.fixedExpenseActions.findFixedExpenseById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Fixed expense not found');
    }

    await this.fixedExpenseActions.deleteFixedExpense(id, familyId);

    return;
  }
  // #endregion

  // #region Misc
  // #endregion
}
