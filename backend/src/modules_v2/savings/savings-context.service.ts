import { Injectable, NotFoundException } from '@nestjs/common';
import { SavingsActionsService } from './savings-actions.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Injectable()
export class SavingsContextService {
  constructor(
    private readonly savingsActions: SavingsActionsService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
    private readonly prisma: PrismaService,
  ) {}

  // #region Private
  private _computeGoalProgress(deposits: { amount: any }[], targetAmount: number) {
    const currentAmount = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
    const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

    return { currentAmount, progress: Math.round(progress * 100) / 100 };
  }

  private _toIsoDate(date: Date): string {
    return date.toISOString().split('T')[0];
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

  private async _loadSavingsFieldConfigs(familyId: string): Promise<Record<string, any>> {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { dashboardConfig: true },
    });
    const dc = (family?.dashboardConfig as Record<string, any>) ?? {};
    return dc?.expenseMappings?.savings?.fieldConfigs ?? {};
  }
  // #endregion

  // #region Create
  async createGoal(familyId: string, input: CreateGoalDto) {
    const goal = await this.savingsActions.createGoal({
      familyId,
      name: input.name,
      targetAmount: input.targetAmount,
      currency: input.currency,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      icon: input.icon,
      color: input.color,
      autoCreateExpense: input.autoCreateExpense,
      paymentTagId: input.paymentTagId,
      paymentTemplateData: input.paymentTemplateData,
    });

    return {
      ...goal,
      targetAmount: Number(goal.targetAmount),
      deposits: goal.deposits.map((d: any) => ({
        ...d,
        amount: Number(d.amount),
      })),
      currentAmount: 0,
      progress: 0,
    };
  }

  async addDeposit(goalId: string, familyId: string, userId: string, input: CreateDepositDto) {
    const goal = await this.savingsActions.findGoalById(goalId, familyId);

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const deposit = await this.savingsActions.createDeposit({
      goalId,
      userId,
      amount: input.amount,
      date: new Date(input.date),
      notes: input.notes,
    });

    // Auto-create expense record if enabled on goal
    if ((goal as any).autoCreateExpense) {
      try {
        const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
        if (defaultTemplate) {
          const columns = (defaultTemplate.columns as any[]) ?? [];
          const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
          const fieldConfigs = await this._loadSavingsFieldConfigs(familyId);
          const hasConfig = Object.keys(fieldConfigs).length > 0;

          const sourceValues: Record<string, any> = {
            goalName: goal.name,
            amount: { amount: input.amount, currency: (goal as any).currency ?? 'PLN' },
            depositDate: this._toIsoDate(new Date(input.date)),
            notes: input.notes ?? '',
            description: `Oszczędności: ${goal.name}${input.notes ? ` – ${input.notes}` : ''}`,
          };

          const data: Record<string, any> = {
            _savingsGoalId: goal.id,
            _savingsGoalName: goal.name,
            _savingsDepositId: deposit.id,
          };

          if (hasConfig) {
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
            if (autoTagIdPool.size > 0) {
              const tagNameMap = await this._buildTagIdToNameMap(familyId, Array.from(autoTagIdPool));
              for (const column of columns) {
                const cfg = fieldConfigs[column?.id];
                if (!cfg || cfg.mode !== 'auto_tags' || column?.type !== 'tag_group') continue;
                const names = (cfg.autoTagIds ?? []).map((id: string) => tagNameMap[id]).filter(Boolean);
                if (names.length > 0) data[column.id] = names;
              }
            }
            const paidCol = columns.find((c: any) => c?.type === 'checkbox' && /paid|oplac|zaplac|rozlicz/i.test(String(c?.id ?? '') + ' ' + String(c?.name ?? '')));
            if (paidCol) data[paidCol.id] = true;
            else data.col_paid = true;
          } else {
            data.col_date = sourceValues.depositDate;
            data.col_amount = sourceValues.amount;
            data.col_paid = true;
            data.col_description = sourceValues.description;
          }

          // Merge per-goal paymentTemplateData
          Object.assign(data,
            typeof (goal as any).paymentTemplateData === 'object' && (goal as any).paymentTemplateData
              ? ((goal as any).paymentTemplateData as Record<string, unknown>)
              : {},
          );

          // paymentTagId override
          const configuredTagId = (goal as any).paymentTagId as string | undefined;
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
        console.error('Savings deposit auto-expense creation failed:', e);
      }
    }

    return {
      ...deposit,
      amount: Number(deposit.amount),
    };
  }
  // #endregion

  // #region Read
  async getGoals(familyId: string) {
    const goals = await this.savingsActions.findGoalsByFamily(familyId);

    return goals.map((goal: any) => {
      const targetAmount = Number(goal.targetAmount);
      const { currentAmount, progress } = this._computeGoalProgress(goal.deposits, targetAmount);

      return {
        ...goal,
        targetAmount,
        deposits: goal.deposits.map((d: any) => ({
          ...d,
          amount: Number(d.amount),
        })),
        currentAmount,
        progress,
      };
    });
  }

  async getDeposits(goalId: string, familyId: string) {
    const goal = await this.savingsActions.findGoalById(goalId, familyId);

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const deposits = await this.savingsActions.findDepositsByGoal(goalId);

    return deposits.map((d: any) => ({
      ...d,
      amount: Number(d.amount),
    }));
  }
  // #endregion

  // #region Update
  async updateGoal(id: string, familyId: string, input: UpdateGoalDto) {
    const existing = await this.savingsActions.findGoalById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    const goal = await this.savingsActions.updateGoal(id, familyId, {
      name: input.name,
      targetAmount: input.targetAmount,
      currency: input.currency,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      icon: input.icon,
      color: input.color,
      autoCreateExpense: input.autoCreateExpense,
      paymentTagId: input.paymentTagId,
      paymentTemplateData: input.paymentTemplateData,
    });

    const targetAmount = Number(goal.targetAmount);
    const { currentAmount, progress } = this._computeGoalProgress(goal.deposits, targetAmount);

    return {
      ...goal,
      targetAmount,
      deposits: goal.deposits.map((d: any) => ({
        ...d,
        amount: Number(d.amount),
      })),
      currentAmount,
      progress,
    };
  }
  // #endregion

  // #region Delete
  async deleteGoal(id: string, familyId: string) {
    const existing = await this.savingsActions.findGoalById(id, familyId);

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    await this.savingsActions.deleteGoal(id, familyId);

    return;
  }
  // #endregion

  // #region Misc
  async getSavingsConfig(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { savingsConfig: true },
    });

    return (family?.savingsConfig as Record<string, any>) ?? {};
  }

  async updateSavingsConfig(familyId: string, config: Record<string, any>) {
    await this.prisma.family.update({
      where: { id: familyId },
      data: { savingsConfig: config },
    });

    return config;
  }
  // #endregion
}
