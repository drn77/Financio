import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TaxForm, UpdateTaxConfigDto, ZusProfile, LumpSumPreset, BusinessProfile } from './dto/update-tax-config.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
