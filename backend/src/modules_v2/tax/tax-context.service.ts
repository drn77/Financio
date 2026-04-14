import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TemplateActionsService } from '../template/template-actions.service';
import { RecordActionsService } from '../template/record-actions.service';
import { TaxForm, UpdateTaxConfigDto, ZusProfile, LumpSumPreset, BusinessProfile } from './dto/update-tax-config.dto';
import { CreateTaxEntryDto } from './dto/create-tax-entry.dto';
import { UpdateTaxEntryDto } from './dto/update-tax-entry.dto';
import { PayTaxEntryDto } from './dto/pay-tax-entry.dto';

type TagMappings = { income?: string; expense?: string; planning?: string; costs?: string; savings?: string };

interface IYearTaxRules {
  scaleThreshold: number;
  scaleRate1: number;
  scaleRate2: number;
  annualTaxReduction: number;
  linearRate: number;
  linearHealthRate: number;
  linearHealthDeductionLimit: number;
  scaleHealthRate: number;
  scaleHealthMinMonthly: number;
  linearHealthMinMonthly: number;
  lumpHealthLowMonthly: number;
  lumpHealthMidMonthly: number;
  lumpHealthHighMonthly: number;
  lumpHealthThresholdLow: number;
  lumpHealthThresholdHigh: number;
  lumpHealthDeductionRate: number;
  zusSocial: {
    retirement: number;
    disability: number;
    sickness: number;
    accident: number;
    laborFund: number;
  };
}

const YEAR_RULES: Record<number, IYearTaxRules> = {
  2026: {
    scaleThreshold: 120000,
    scaleRate1: 0.12,
    scaleRate2: 0.32,
    annualTaxReduction: 3600,
    linearRate: 0.19,
    linearHealthRate: 0.049,
    linearHealthDeductionLimit: 13800,
    scaleHealthRate: 0.09,
    scaleHealthMinMonthly: 381.78,
    linearHealthMinMonthly: 381.78,
    lumpHealthLowMonthly: 461.66,
    lumpHealthMidMonthly: 769.43,
    lumpHealthHighMonthly: 1384.97,
    lumpHealthThresholdLow: 60000,
    lumpHealthThresholdHigh: 300000,
    lumpHealthDeductionRate: 0.5,
    zusSocial: {
      retirement: 1015.78,
      disability: 416.3,
      sickness: 127.49,
      accident: 86.9,
      laborFund: 127.49,
    },
  },
};

export interface ITaxConfig {
  year: number;
  businessProfile: BusinessProfile;
  form: TaxForm;
  lumpSumRate: number;
  lumpSumPreset: LumpSumPreset;
  includeSickness: boolean;
  includeSocialContributions: boolean;
  includeHealthContribution: boolean;
  zusProfile: ZusProfile;
}

@Injectable()
export class TaxContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateActions: TemplateActionsService,
    private readonly recordActions: RecordActionsService,
  ) {}

  private _getDefaultConfig(): ITaxConfig {
    const now = new Date();
    return {
      year: now.getFullYear(),
      businessProfile: BusinessProfile.CUSTOM,
      form: TaxForm.SCALE,
      lumpSumRate: 8.5,
      lumpSumPreset: LumpSumPreset.GENERAL_8_5,
      includeSickness: true,
      includeSocialContributions: true,
      includeHealthContribution: true,
      zusProfile: ZusProfile.FULL,
    };
  }

  private _presetRate(preset: LumpSumPreset): number {
    switch (preset) {
      case LumpSumPreset.IT_12:
        return 12;
      case LumpSumPreset.LIBERAL_15:
        return 15;
      case LumpSumPreset.GENERAL_8_5:
        return 8.5;
      case LumpSumPreset.CUSTOM:
      default:
        return 8.5;
    }
  }

  private _applyBusinessProfile(profile: BusinessProfile, current: ITaxConfig): ITaxConfig {
    if (profile === BusinessProfile.IT_B2B) {
      return {
        ...current,
        businessProfile: profile,
        form: TaxForm.LUMPSUM,
        lumpSumPreset: LumpSumPreset.IT_12,
        lumpSumRate: 12,
        zusProfile: ZusProfile.FULL,
        includeSocialContributions: true,
        includeSickness: true,
        includeHealthContribution: true,
      };
    }

    if (profile === BusinessProfile.CONSULTING) {
      return {
        ...current,
        businessProfile: profile,
        form: TaxForm.LUMPSUM,
        lumpSumPreset: LumpSumPreset.LIBERAL_15,
        lumpSumRate: 15,
        zusProfile: ZusProfile.FULL,
        includeSocialContributions: true,
        includeSickness: true,
        includeHealthContribution: true,
      };
    }

    if (profile === BusinessProfile.TRADE) {
      return {
        ...current,
        businessProfile: profile,
        form: TaxForm.LUMPSUM,
        lumpSumPreset: LumpSumPreset.GENERAL_8_5,
        lumpSumRate: 8.5,
        zusProfile: ZusProfile.FULL,
        includeSocialContributions: true,
        includeSickness: true,
        includeHealthContribution: true,
      };
    }

    if (profile === BusinessProfile.STARTING) {
      return {
        ...current,
        businessProfile: profile,
        form: TaxForm.SCALE,
        lumpSumPreset: LumpSumPreset.CUSTOM,
        zusProfile: ZusProfile.STARTER,
        includeSocialContributions: true,
        includeSickness: false,
        includeHealthContribution: true,
      };
    }

    return {
      ...current,
      businessProfile: BusinessProfile.CUSTOM,
    };
  }

  private _resolveRules(year: number): IYearTaxRules {
    return YEAR_RULES[year] ?? YEAR_RULES[2026];
  }

  private async _buildTagIdToNameMap(familyId: string, tagMappings: TagMappings): Promise<Record<string, string>> {
    const tagIds = [tagMappings.income, tagMappings.expense, tagMappings.planning, tagMappings.costs, tagMappings.savings].filter(Boolean) as string[];
    if (tagIds.length === 0) return {};

    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, tagGroup: { familyId } },
      select: { id: true, name: true },
    });

    const map: Record<string, string> = {};
    for (const tag of tags) map[tag.id] = tag.name;
    return map;
  }

  private _extractAmount(colAmount: any): number {
    if (!colAmount) return 0;
    if (typeof colAmount === 'number') return colAmount;
    if (typeof colAmount === 'object' && colAmount.amount) return Number(colAmount.amount);
    return 0;
  }

  private _extractRecordAmount(data: any, columns: any[]): number {
    const legacyAmount = this._extractAmount(data?.col_amount);
    if (legacyAmount) return legacyAmount;

    const currencyCol = columns.find((c: any) => c.type === 'currency');
    if (currencyCol) return this._extractAmount(data?.[currencyCol.id]);

    return 0;
  }

  private _hasTag(data: any, columns: any[], tagName?: string): boolean {
    if (!tagName) return false;
    const tagGroupCols = columns.filter((c: any) => c.type === 'tag_group');
    for (const col of tagGroupCols) {
      const cellVal = data?.[col.id];
      const selected: string[] = Array.isArray(cellVal) ? cellVal : cellVal ? [cellVal] : [];
      if (selected.includes(tagName)) return true;
    }
    return false;
  }

  private _calculateSocialMonthly(config: ITaxConfig, rules: IYearTaxRules) {
    let base = { ...rules.zusSocial };
    if (config.zusProfile === ZusProfile.PREFERENTIAL) {
      base = {
        retirement: 442.9,
        disability: 181.48,
        sickness: 55.55,
        accident: 37.92,
        laborFund: 0,
      };
    }
    if (config.zusProfile === ZusProfile.STARTER) {
      base = {
        retirement: 0,
        disability: 0,
        sickness: 0,
        accident: 0,
        laborFund: 0,
      };
    }

    const social = {
      retirement: base.retirement,
      disability: base.disability,
      sickness: config.includeSickness ? base.sickness : 0,
      accident: base.accident,
      laborFund: base.laborFund,
    };

    const socialTotal = config.includeSocialContributions
      ? Object.values(social).reduce((s, v) => s + v, 0)
      : 0;

    return { social, socialTotal: Math.round(socialTotal * 100) / 100 };
  }

  private _calculateHealthMonthly(
    config: ITaxConfig,
    rules: IYearTaxRules,
    revenueMonth: number,
    costsMonth: number,
    socialMonth: number,
    revenueYtd: number,
    monthsElapsed: number,
  ): number {
    if (!config.includeHealthContribution) return 0;

    if (config.form === TaxForm.LUMPSUM) {
      // Approximate current-year annualized bracket for monthly estimate
      const annualizedRevenue = monthsElapsed > 0 ? (revenueYtd / monthsElapsed) * 12 : 0;
      if (annualizedRevenue <= rules.lumpHealthThresholdLow) return rules.lumpHealthLowMonthly;
      if (annualizedRevenue <= rules.lumpHealthThresholdHigh) return rules.lumpHealthMidMonthly;
      return rules.lumpHealthHighMonthly;
    }

    const incomeAfterSocial = Math.max(0, revenueMonth - costsMonth - socialMonth);
    if (config.form === TaxForm.LINEAR) {
      return Math.round(Math.max(rules.linearHealthMinMonthly, incomeAfterSocial * rules.linearHealthRate) * 100) / 100;
    }

    return Math.round(Math.max(rules.scaleHealthMinMonthly, incomeAfterSocial * rules.scaleHealthRate) * 100) / 100;
  }

  private _taxScale(base: number, monthIndex: number, rules: IYearTaxRules): number {
    const raw = base <= rules.scaleThreshold
      ? base * rules.scaleRate1
      : (rules.scaleThreshold * rules.scaleRate1) + (base - rules.scaleThreshold) * rules.scaleRate2;

    // Monthly cumulative tax reduction up to annual cap.
    const reductionToDate = Math.min(rules.annualTaxReduction, monthIndex * (rules.annualTaxReduction / 12));
    return Math.max(0, raw - reductionToDate);
  }

  private _round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async getTaxConfig(familyId: string): Promise<ITaxConfig> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId }, select: { taxConfig: true } });
    return { ...this._getDefaultConfig(), ...((family?.taxConfig as any) ?? {}) };
  }

  async updateTaxConfig(familyId: string, payload: UpdateTaxConfigDto): Promise<ITaxConfig> {
    const prev = await this.getTaxConfig(familyId);
    let next: ITaxConfig = { ...prev, ...payload };

    if (payload.businessProfile) {
      next = this._applyBusinessProfile(payload.businessProfile, next);
    }

    const isLumpSum = next.form === TaxForm.LUMPSUM;

    if (payload.lumpSumPreset) {
      next.lumpSumPreset = payload.lumpSumPreset;
      if (isLumpSum && payload.lumpSumPreset !== LumpSumPreset.CUSTOM) {
        next.businessProfile = BusinessProfile.CUSTOM;
        next.lumpSumRate = this._presetRate(payload.lumpSumPreset);
      }
    }

    if (payload.lumpSumRate !== undefined) {
      next.lumpSumRate = payload.lumpSumRate;
      if (isLumpSum) {
        next.businessProfile = BusinessProfile.CUSTOM;
      }
      if (isLumpSum && !payload.lumpSumPreset) {
        next.lumpSumPreset = LumpSumPreset.CUSTOM;
      }
    }

    await this.prisma.family.update({
      where: { id: familyId },
      data: { taxConfig: next as any },
    });

    return next;
  }

  async getMonthlyTaxSummary(familyId: string, month?: number, year?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    const yearStart = new Date(targetYear, 0, 1);

    const [family, template] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: familyId }, select: { tagMappings: true, taxConfig: true } }),
      this.prisma.template.findFirst({
        where: { familyId, isDefault: true },
        include: { records: { where: { createdAt: { gte: yearStart, lte: monthEnd } }, orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    const tagMappings = ((family?.tagMappings as any) ?? {}) as TagMappings;
    const config: ITaxConfig = { ...this._getDefaultConfig(), ...((family?.taxConfig as any) ?? {}) };
    if (!config.year) config.year = targetYear;
    const rules = this._resolveRules(config.year);
    const columns = (template?.columns as any[]) ?? [];

    const tagIdToName = await this._buildTagIdToNameMap(familyId, tagMappings);
    const incomeTag = tagMappings.income ? tagIdToName[tagMappings.income] : undefined;
    const costTag = tagMappings.costs ? tagIdToName[tagMappings.costs] : undefined;

    const revenueByMonth = Array(12).fill(0) as number[];
    const costsByMonth = Array(12).fill(0) as number[];

    for (const record of template?.records ?? []) {
      const data = record.data as any;
      const amount = this._extractRecordAmount(data, columns);
      if (amount <= 0) continue;
      const created = new Date((record as any).createdAt);
      const m = created.getMonth();

      if (this._hasTag(data, columns, incomeTag)) revenueByMonth[m] += amount;
      if (this._hasTag(data, columns, costTag)) costsByMonth[m] += amount;
    }

    let revenueYtd = 0;
    let costsYtd = 0;
    let socialYtd = 0;
    let healthYtd = 0;
    let taxDueYtd = 0;
    let taxDuePrev = 0;

    let monthlyRevenue = 0;
    let monthlyCosts = 0;
    let monthlySocial = 0;
    let monthlyHealth = 0;
    let monthlyTax = 0;

    for (let i = 0; i < targetMonth; i++) {
      const rev = revenueByMonth[i] ?? 0;
      const cst = costsByMonth[i] ?? 0;
      revenueYtd += rev;
      costsYtd += cst;

      const socialPart = this._calculateSocialMonthly(config, rules);
      const social = socialPart.socialTotal;
      socialYtd += social;

      const health = this._calculateHealthMonthly(config, rules, rev, cst, social, revenueYtd, i + 1);
      healthYtd += health;

      const taxableYtd = Math.max(0, revenueYtd - costsYtd - socialYtd);

      if (config.form === TaxForm.SCALE) {
        taxDueYtd = this._round2(this._taxScale(taxableYtd, i + 1, rules));
      } else if (config.form === TaxForm.LINEAR) {
        const deductibleHealth = Math.min(healthYtd, rules.linearHealthDeductionLimit);
        const taxableLinear = Math.max(0, taxableYtd - deductibleHealth);
        taxDueYtd = this._round2(taxableLinear * rules.linearRate);
      } else {
        const deductibleHealth = config.includeHealthContribution ? healthYtd * rules.lumpHealthDeductionRate : 0;
        const taxableLump = Math.max(0, revenueYtd - socialYtd - deductibleHealth);
        taxDueYtd = this._round2(taxableLump * (config.lumpSumRate / 100));
      }

      const taxThisMonth = this._round2(Math.max(0, taxDueYtd - taxDuePrev));
      taxDuePrev = taxDueYtd;

      if (i === targetMonth - 1) {
        monthlyRevenue = this._round2(rev);
        monthlyCosts = this._round2(cst);
        monthlySocial = this._round2(social);
        monthlyHealth = this._round2(health);
        monthlyTax = this._round2(taxThisMonth);
      }
    }

    const monthlyTaxable = this._round2(Math.max(0, monthlyRevenue - monthlyCosts - monthlySocial));
    const monthlyTotal = this._round2(monthlyTax + monthlySocial + monthlyHealth);
    const ytdTotal = this._round2(taxDueYtd + socialYtd + healthYtd);

    return {
      period: { year: targetYear, month: targetMonth },
      config,
      monthly: {
        revenue: monthlyRevenue,
        costs: monthlyCosts,
        taxableBase: monthlyTaxable,
        pit: monthlyTax,
        zus: {
          social: this._calculateSocialMonthly(config, rules).social,
          socialTotal: monthlySocial,
          health: monthlyHealth,
        },
        total: monthlyTotal,
      },
      ytd: {
        revenue: this._round2(revenueYtd),
        costs: this._round2(costsYtd),
        taxableBase: this._round2(Math.max(0, revenueYtd - costsYtd - socialYtd)),
        pitDue: this._round2(taxDueYtd),
        pitThisMonth: monthlyTax,
        zus: {
          socialTotal: this._round2(socialYtd),
          healthTotal: this._round2(healthYtd),
        },
        totalDue: ytdTotal,
        totalThisMonth: monthlyTotal,
      },
      assumptions: [
        'Rozliczenie narastająco YTD dla wybranej formy JDG (skala/liniowy/ryczałt).',
        'Koszty są liczone na podstawie mapowania tagu „koszty” i dotyczą rekordów z głównego szablonu.',
        'Parametry roczne (progi, stawki i minima) pochodzą z ustawień roku w kalkulatorze.',
        `Profil działalności: ${config.businessProfile}.`,
        `Preset ZUS: ${config.zusProfile}. Kwoty są estymacyjne i mogą wymagać dostrojenia do Twojej sytuacji.`,
        `Preset ryczałtu: ${config.lumpSumPreset} (stawka ${config.lumpSumRate}%).`,
      ],
    };
  }

  // ──────── Tax Entries ────────

  private _mapEntry(entry: any) {
    return {
      ...entry,
      amount: Number(entry.amount),
      calculatedAmount: entry.calculatedAmount != null ? Number(entry.calculatedAmount) : null,
    };
  }

  async getOrCreateMonthlyEntries(familyId: string, month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    // Always recalculate from the tax calculator
    const summary = await this.getMonthlyTaxSummary(familyId, targetMonth, targetYear);
    const zusAmount = this._round2((summary.monthly.zus?.socialTotal ?? 0) + (summary.monthly.zus?.health ?? 0));
    const pitAmount = this._round2(summary.monthly.pit ?? 0);

    const autoEntries: Array<{ type: string; name: string; calculated: number }> = [
      { type: 'ZUS', name: 'ZUS', calculated: zusAmount },
      { type: 'PIT', name: 'Podatek dochodowy', calculated: pitAmount },
    ];

    // Upsert ZUS and PIT — create if missing, recalculate if unpaid
    for (const { type, name, calculated } of autoEntries) {
      const existing = await this.prisma.taxEntry.findFirst({
        where: { familyId, month: targetMonth, year: targetYear, type },
      });

      if (!existing) {
        await this.prisma.taxEntry.create({
          data: {
            familyId,
            type,
            name,
            month: targetMonth,
            year: targetYear,
            calculatedAmount: calculated,
            amount: calculated,
          },
        });
      } else if (!existing.isPaid) {
        const wasEdited = Number(existing.amount) !== Number(existing.calculatedAmount);
        await this.prisma.taxEntry.update({
          where: { id: existing.id },
          data: {
            calculatedAmount: calculated,
            ...(wasEdited ? {} : { amount: calculated }),
          },
        });
      }
    }

    // Copy recurring custom entries from previous month (only if they don't exist yet)
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const recurring = await this.prisma.taxEntry.findMany({
      where: { familyId, month: prevMonth, year: prevYear, isRecurring: true },
    });

    for (const rec of recurring) {
      await this.prisma.taxEntry.upsert({
        where: {
          familyId_type_month_year_name: {
            familyId,
            type: rec.type,
            month: targetMonth,
            year: targetYear,
            name: rec.name,
          },
        },
        update: {},
        create: {
          familyId,
          type: rec.type,
          name: rec.name,
          month: targetMonth,
          year: targetYear,
          calculatedAmount: null,
          amount: Number(rec.amount),
          isRecurring: true,
        },
      });
    }

    const entries = await this.prisma.taxEntry.findMany({
      where: { familyId, month: targetMonth, year: targetYear },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return entries.map((e) => this._mapEntry(e));
  }

  async recalculateEntries(familyId: string, month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const summary = await this.getMonthlyTaxSummary(familyId, targetMonth, targetYear);
    const zusAmount = this._round2((summary.monthly.zus?.socialTotal ?? 0) + (summary.monthly.zus?.health ?? 0));
    const pitAmount = this._round2(summary.monthly.pit ?? 0);

    const recalcMap: Record<string, number> = { ZUS: zusAmount, PIT: pitAmount };

    for (const [type, calculated] of Object.entries(recalcMap)) {
      const entry = await this.prisma.taxEntry.findFirst({
        where: { familyId, month: targetMonth, year: targetYear, type, isPaid: false },
      });
      if (entry) {
        const wasEdited = Number(entry.amount) !== Number(entry.calculatedAmount);
        await this.prisma.taxEntry.update({
          where: { id: entry.id },
          data: {
            calculatedAmount: calculated,
            ...(wasEdited ? {} : { amount: calculated }),
          },
        });
      } else {
        await this.prisma.taxEntry.upsert({
          where: {
            familyId_type_month_year_name: {
              familyId,
              type,
              month: targetMonth,
              year: targetYear,
              name: type === 'ZUS' ? 'ZUS' : 'Podatek dochodowy',
            },
          },
          update: { calculatedAmount: calculated, amount: calculated },
          create: {
            familyId,
            type,
            name: type === 'ZUS' ? 'ZUS' : 'Podatek dochodowy',
            month: targetMonth,
            year: targetYear,
            calculatedAmount: calculated,
            amount: calculated,
          },
        });
      }
    }

    const entries = await this.prisma.taxEntry.findMany({
      where: { familyId, month: targetMonth, year: targetYear },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return entries.map((e) => this._mapEntry(e));
  }

  async createTaxEntry(familyId: string, input: CreateTaxEntryDto) {
    const entry = await this.prisma.taxEntry.create({
      data: {
        familyId,
        type: input.type,
        name: input.name,
        month: input.month,
        year: input.year,
        amount: input.amount,
        notes: input.notes,
        isRecurring: input.isRecurring ?? false,
      },
    });
    return this._mapEntry(entry);
  }

  async updateTaxEntry(familyId: string, id: string, input: UpdateTaxEntryDto) {
    const entry = await this.prisma.taxEntry.findFirst({ where: { id, familyId } });
    if (!entry) throw new NotFoundException('Tax entry not found');

    const updated = await this.prisma.taxEntry.update({
      where: { id },
      data: {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    return this._mapEntry(updated);
  }

  async payTaxEntry(familyId: string, id: string, input: PayTaxEntryDto) {
    const entry = await this.prisma.taxEntry.findFirst({ where: { id, familyId } });
    if (!entry) throw new NotFoundException('Tax entry not found');

    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    const amount = input.amount ?? Number(entry.amount);

    const updated = await this.prisma.taxEntry.update({
      where: { id },
      data: { isPaid: true, paidAt: paymentDate, amount },
    });

    // Auto-create expense record
    try {
      const defaultTemplate = await this.templateActions.findDefaultTemplate(familyId);
      if (defaultTemplate) {
        const maxSort = await this.recordActions.getMaxSortOrder(defaultTemplate.id);
        const autoExpenseData = await this._buildTaxAutoExpenseData(
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
      console.error('Tax auto-expense creation failed:', e);
    }

    return this._mapEntry(updated);
  }

  async deleteTaxEntry(familyId: string, id: string) {
    const entry = await this.prisma.taxEntry.findFirst({ where: { id, familyId } });
    if (!entry) throw new NotFoundException('Tax entry not found');

    await this.prisma.taxEntry.delete({ where: { id } });
    return { success: true };
  }

  // ──────── Auto-Expense for Tax Payment ────────

  private _extractTemplateColumns(templateColumns: any): { id: string; type?: string; tagGroupId?: string }[] {
    return Array.isArray(templateColumns)
      ? templateColumns.filter((c: any) => c && typeof c.id === 'string')
      : [];
  }

  private async _loadTaxFieldConfigs(familyId: string): Promise<Record<string, any>> {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { dashboardConfig: true },
    });
    const dc = (family?.dashboardConfig as any) ?? {};
    return dc?.expenseMappings?.taxes?.fieldConfigs ?? {};
  }

  private async _buildTagIdToNameMapById(familyId: string, tagIds: string[]): Promise<Record<string, string>> {
    if (!tagIds.length) return {};
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds }, tagGroup: { familyId } },
      select: { id: true, name: true },
    });
    const map: Record<string, string> = {};
    for (const tag of tags) map[tag.id] = tag.name;
    return map;
  }

  private async _buildTaxAutoExpenseData(
    familyId: string,
    templateColumnsRaw: any,
    entry: any,
    paymentDate: Date,
  ): Promise<Record<string, any>> {
    const columns = this._extractTemplateColumns(templateColumnsRaw);
    const fieldConfigs = await this._loadTaxFieldConfigs(familyId);
    const hasConfig = Object.keys(fieldConfigs).length > 0;

    const sourceValues: Record<string, any> = {
      name: entry.name,
      type: entry.type,
      amount: { amount: Number(entry.amount), currency: 'PLN' },
      paymentDate: paymentDate.toISOString().split('T')[0],
      notes: entry.notes ?? '',
      description: `${entry.name} (${entry.month}/${entry.year})`,
    };

    const data: Record<string, any> = {
      _taxEntryId: entry.id,
      _taxType: entry.type,
      _taxName: entry.name,
      _taxPeriod: `${entry.month}/${entry.year}`,
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
        const tagNameMap = await this._buildTagIdToNameMapById(familyId, Array.from(autoTagIdPool));
        for (const column of columns) {
          const cfg = fieldConfigs[column.id];
          if (!cfg || cfg.mode !== 'auto_tags' || column.type !== 'tag_group') continue;
          const names = (cfg.autoTagIds ?? []).map((id: string) => tagNameMap[id]).filter(Boolean);
          if (names.length > 0) data[column.id] = names;
        }
      }

      // Always mark as paid
      const paidCol = columns.find((c: any) => c.type === 'checkbox' && /paid|oplac|zaplac|rozlicz/i.test(String(c.id ?? '') + ' ' + String(c.name ?? '')));
      if (paidCol) data[paidCol.id] = true;
      else data.col_paid = true;
    } else {
      // Legacy fallback
      data.col_date = paymentDate.toISOString().split('T')[0];
      data.col_amount = sourceValues.amount;
      data.col_description = sourceValues.description;
      data.col_paid = true;
    }

    return data;
  }
}
