'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, Calculator, Info } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

type TaxForm = 'SCALE' | 'LINEAR' | 'LUMPSUM';
type ZusProfile = 'FULL' | 'PREFERENTIAL' | 'STARTER';
type LumpSumPreset = 'CUSTOM' | 'GENERAL_8_5' | 'IT_12' | 'LIBERAL_15';
type BusinessProfile = 'CUSTOM' | 'IT_B2B' | 'CONSULTING' | 'TRADE' | 'STARTING';

interface ITaxConfig {
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

const ZUS_PROFILE_LABEL: Record<ZusProfile, string> = {
  FULL: 'Duży ZUS',
  PREFERENTIAL: 'Preferencyjny ZUS',
  STARTER: 'Ulga na start',
};

const LUMP_SUM_PRESET_LABEL: Record<LumpSumPreset, string> = {
  CUSTOM: 'Niestandardowa',
  GENERAL_8_5: 'Ogólna 8.5%',
  IT_12: 'IT 12%',
  LIBERAL_15: 'Wolne zawody 15%',
};

const BUSINESS_PROFILE_LABEL: Record<BusinessProfile, string> = {
  CUSTOM: 'Niestandardowy',
  IT_B2B: 'IT B2B',
  CONSULTING: 'Doradztwo / wolne zawody',
  TRADE: 'Handel / usługi ogólne',
  STARTING: 'Nowa działalność',
};

const BUSINESS_PROFILE_TOOLTIP: Record<BusinessProfile, string> = {
  CUSTOM: 'Tryb ręczny - nic nie nadpisuje automatycznie.',
  IT_B2B: 'Ustawia: ryczałt 12%, Duży ZUS, pełne składki.',
  CONSULTING: 'Ustawia: ryczałt 15%, Duży ZUS, pełne składki.',
  TRADE: 'Ustawia: ryczałt 8.5%, Duży ZUS, pełne składki.',
  STARTING: 'Ustawia: skala podatkowa, Ulga na start, bez chorobowej.',
};

const ZUS_PROFILE_TOOLTIP: Record<ZusProfile, string> = {
  FULL: 'Pełne składki społeczne + zdrowotna, standardowy wariant JDG.',
  PREFERENTIAL: 'Obniżona podstawa składek społecznych + zdrowotna.',
  STARTER: 'Ulga na start: bez składek społecznych, tylko zdrowotna.',
};

const LUMP_SUM_PRESET_TOOLTIP: Record<LumpSumPreset, string> = {
  CUSTOM: 'Stawka ustawiana ręcznie.',
  GENERAL_8_5: 'Popularna stawka 8.5% dla części usług i handlu.',
  IT_12: 'Stawka 12% typowa dla części usług IT.',
  LIBERAL_15: 'Stawka 15% typowa dla wybranych wolnych zawodów.',
};

function formatPLN(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
}

const TAX_FORM_LABEL: Record<TaxForm, string> = {
  SCALE: 'Skala podatkowa',
  LINEAR: 'Podatek liniowy',
  LUMPSUM: 'Ryczałt',
};

export default function TaxesPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [config, setConfig] = useState<ITaxConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, sum] = await Promise.all([api.getTaxConfig(), api.getTaxSummary()]);
      setConfig(cfg as ITaxConfig);
      setSummary(sum);
    } catch (e) {
      console.error('Failed to load taxes data', e);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentMonthLabel = useMemo(() => {
    if (!summary?.period) return '';
    const d = new Date(summary.period.year, summary.period.month - 1, 1);
    return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  }, [summary]);

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      await api.updateTaxConfig(config);
      const [freshConfig, sum] = await Promise.all([
        api.getTaxConfig(),
        api.getTaxSummary(config.year ? summary?.period?.month : undefined, config.year),
      ]);
      setConfig(freshConfig as ITaxConfig);
      setSummary(sum);
      setShowConfig(false);
    } catch (e) {
      console.error('Failed to save tax config', e);
    } finally {
      setSavingConfig(false);
    }
  };

  const applyPreset = (preset: ZusProfile) => {
    setConfig((prev) => {
      if (!prev) return prev;
      if (preset === 'STARTER') {
        return {
          ...prev,
          businessProfile: 'CUSTOM',
          zusProfile: preset,
          includeSocialContributions: true,
          includeSickness: false,
          includeHealthContribution: true,
        };
      }
      if (preset === 'PREFERENTIAL') {
        return {
          ...prev,
          businessProfile: 'CUSTOM',
          zusProfile: preset,
          includeSocialContributions: true,
          includeSickness: true,
          includeHealthContribution: true,
        };
      }
      return {
        ...prev,
        businessProfile: 'CUSTOM',
        zusProfile: preset,
        includeSocialContributions: true,
        includeSickness: true,
        includeHealthContribution: true,
      };
    });
  };

  const applyLumpSumPreset = (preset: LumpSumPreset) => {
    setConfig((prev) => {
      if (!prev) return prev;
      if (preset === 'IT_12') return { ...prev, businessProfile: 'CUSTOM', form: 'LUMPSUM', lumpSumPreset: preset, lumpSumRate: 12 };
      if (preset === 'LIBERAL_15') return { ...prev, businessProfile: 'CUSTOM', form: 'LUMPSUM', lumpSumPreset: preset, lumpSumRate: 15 };
      if (preset === 'GENERAL_8_5') return { ...prev, businessProfile: 'CUSTOM', form: 'LUMPSUM', lumpSumPreset: preset, lumpSumRate: 8.5 };
      return { ...prev, businessProfile: 'CUSTOM', form: 'LUMPSUM', lumpSumPreset: 'CUSTOM' };
    });
  };

  const applyBusinessProfile = (profile: BusinessProfile) => {
    setConfig((prev) => {
      if (!prev) return prev;
      if (profile === 'IT_B2B') {
        return {
          ...prev,
          businessProfile: profile,
          form: 'LUMPSUM',
          lumpSumPreset: 'IT_12',
          lumpSumRate: 12,
          zusProfile: 'FULL',
          includeSocialContributions: true,
          includeSickness: true,
          includeHealthContribution: true,
        };
      }
      if (profile === 'CONSULTING') {
        return {
          ...prev,
          businessProfile: profile,
          form: 'LUMPSUM',
          lumpSumPreset: 'LIBERAL_15',
          lumpSumRate: 15,
          zusProfile: 'FULL',
          includeSocialContributions: true,
          includeSickness: true,
          includeHealthContribution: true,
        };
      }
      if (profile === 'TRADE') {
        return {
          ...prev,
          businessProfile: profile,
          form: 'LUMPSUM',
          lumpSumPreset: 'GENERAL_8_5',
          lumpSumRate: 8.5,
          zusProfile: 'FULL',
          includeSocialContributions: true,
          includeSickness: true,
          includeHealthContribution: true,
        };
      }
      if (profile === 'STARTING') {
        return {
          ...prev,
          businessProfile: profile,
          form: 'SCALE',
          lumpSumPreset: 'CUSTOM',
          zusProfile: 'STARTER',
          includeSocialContributions: true,
          includeSickness: false,
          includeHealthContribution: true,
        };
      }
      return { ...prev, businessProfile: 'CUSTOM' };
    });
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Podatki</h1>
          <p className="text-sm text-muted-foreground">
            Estymacja składek ZUS i podatku dochodowego dla {currentMonthLabel || 'bieżącego miesiąca'}.
          </p>
        </div>

        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="mr-1 h-4 w-4" /> Konfiguracja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfiguracja podatków</DialogTitle>
              <DialogDescription>
                Wybierz formę opodatkowania i parametry kalkulacji.
              </DialogDescription>
            </DialogHeader>

            {config && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Rok podatkowy</Label>
                  <Input
                    type="number"
                    min={2024}
                    max={2035}
                    value={config.year}
                    onChange={(e) => setConfig((prev) => prev ? { ...prev, year: Number(e.target.value || new Date().getFullYear()) } : prev)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>Profil działalności</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground">
                          <Info className="h-4 w-4" aria-label="Opis profilu działalności" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Preset profilu ustawia formę opodatkowania, stawkę ryczałtu oraz wariant ZUS.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={config.businessProfile ?? 'CUSTOM'}
                    onValueChange={(v) => applyBusinessProfile(v as BusinessProfile)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT_B2B">IT B2B</SelectItem>
                      <SelectItem value="CONSULTING">Doradztwo / wolne zawody</SelectItem>
                      <SelectItem value="TRADE">Handel / usługi ogólne</SelectItem>
                      <SelectItem value="STARTING">Nowa działalność</SelectItem>
                      <SelectItem value="CUSTOM">Niestandardowy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyBusinessProfile('IT_B2B')}>IT B2B</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{BUSINESS_PROFILE_TOOLTIP.IT_B2B}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyBusinessProfile('CONSULTING')}>Doradztwo</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{BUSINESS_PROFILE_TOOLTIP.CONSULTING}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyBusinessProfile('TRADE')}>Handel</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{BUSINESS_PROFILE_TOOLTIP.TRADE}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyBusinessProfile('STARTING')}>Nowa firma</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{BUSINESS_PROFILE_TOOLTIP.STARTING}</TooltipContent>
                  </Tooltip>
                </div>

                <div className="space-y-1.5">
                  <Label>Forma opodatkowania</Label>
                  <Select
                    value={config.form}
                    onValueChange={(v) => setConfig((prev) => prev ? { ...prev, form: v as TaxForm, businessProfile: 'CUSTOM' } : prev)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCALE">Skala podatkowa</SelectItem>
                      <SelectItem value="LINEAR">Podatek liniowy</SelectItem>
                      <SelectItem value="LUMPSUM">Ryczałt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label>Preset ZUS (JDG)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground">
                          <Info className="h-4 w-4" aria-label="Opis presetu ZUS" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Wybór presetu zmienia domyślne składki społeczne i zdrowotną dla JDG.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={config.zusProfile}
                    onValueChange={(v) => applyPreset(v as ZusProfile)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">Duży ZUS</SelectItem>
                      <SelectItem value="PREFERENTIAL">Preferencyjny ZUS</SelectItem>
                      <SelectItem value="STARTER">Ulga na start</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyPreset('FULL')}>Duży ZUS</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{ZUS_PROFILE_TOOLTIP.FULL}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyPreset('PREFERENTIAL')}>Preferencyjny</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{ZUS_PROFILE_TOOLTIP.PREFERENTIAL}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" onClick={() => applyPreset('STARTER')}>Ulga na start</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{ZUS_PROFILE_TOOLTIP.STARTER}</TooltipContent>
                  </Tooltip>
                </div>

                {config.form === 'LUMPSUM' && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label>Preset ryczałtu</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                              <Info className="h-4 w-4" aria-label="Opis presetu ryczałtu" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            Preset ustawia gotową stawkę ryczałtu. W razie potrzeby ustaw stawkę ręcznie.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select
                        value={config.lumpSumPreset ?? 'CUSTOM'}
                        onValueChange={(v) => applyLumpSumPreset(v as LumpSumPreset)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GENERAL_8_5">Ogólna 8.5%</SelectItem>
                          <SelectItem value="IT_12">IT 12%</SelectItem>
                          <SelectItem value="LIBERAL_15">Wolne zawody 15%</SelectItem>
                          <SelectItem value="CUSTOM">Niestandardowa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="outline" onClick={() => applyLumpSumPreset('GENERAL_8_5')}>8.5%</Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">{LUMP_SUM_PRESET_TOOLTIP.GENERAL_8_5}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="outline" onClick={() => applyLumpSumPreset('IT_12')}>12%</Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">{LUMP_SUM_PRESET_TOOLTIP.IT_12}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="outline" onClick={() => applyLumpSumPreset('LIBERAL_15')}>15%</Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">{LUMP_SUM_PRESET_TOOLTIP.LIBERAL_15}</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Stawka ryczałtu (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={config.lumpSumRate}
                        onChange={(e) => setConfig((prev) => prev ? { ...prev, lumpSumRate: Number(e.target.value || 0), lumpSumPreset: 'CUSTOM' } : prev)}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Uwzględniaj składki społeczne</p>
                    <p className="text-xs text-muted-foreground">Emerytalna, rentowa, wypadkowa, FP</p>
                  </div>
                  <Checkbox
                    checked={config.includeSocialContributions}
                    onCheckedChange={(v) => setConfig((prev) => prev ? { ...prev, includeSocialContributions: !!v } : prev)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Uwzględniaj chorobową</p>
                    <p className="text-xs text-muted-foreground">Dobrowolna część składek społecznych</p>
                  </div>
                  <Checkbox
                    checked={config.includeSickness}
                    onCheckedChange={(v) => setConfig((prev) => prev ? { ...prev, includeSickness: !!v } : prev)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Uwzględniaj składkę zdrowotną</p>
                    <p className="text-xs text-muted-foreground">Wyliczenie zależne od formy opodatkowania</p>
                  </div>
                  <Checkbox
                    checked={config.includeHealthContribution}
                    onCheckedChange={(v) => setConfig((prev) => prev ? { ...prev, includeHealthContribution: !!v } : prev)}
                  />
                </div>

                <Button className="w-full" onClick={saveConfig} disabled={savingConfig}>
                  {savingConfig ? 'Zapisywanie...' : 'Zapisz konfigurację'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nie udało się pobrać danych podatkowych.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Przychód</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatPLN(summary?.monthly?.revenue ?? 0)}</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Koszty (mapowanie „koszty”)</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatPLN(summary?.monthly?.costs ?? 0)}</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Podstawa opodatkowania</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatPLN(summary?.monthly?.taxableBase ?? 0)}</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Łącznie do zapłaty (miesięcznie)</CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-primary">{formatPLN(summary?.monthly?.total ?? 0)}</CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Podatek dochodowy</CardTitle>
                <CardDescription>
                  {TAX_FORM_LABEL[summary.config?.form as TaxForm] ?? '—'}
                  {summary?.config?.form === 'LUMPSUM' ? ` · ${LUMP_SUM_PRESET_LABEL[(summary?.config?.lumpSumPreset as LumpSumPreset) ?? 'CUSTOM']}` : ''}
                  {summary?.config?.businessProfile ? ` · ${BUSINESS_PROFILE_LABEL[(summary?.config?.businessProfile as BusinessProfile) ?? 'CUSTOM']}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm py-1">
                  <span>PIT (estymacja)</span>
                  <strong>{formatPLN(summary?.monthly?.pit ?? 0)}</strong>
                </div>
                <div className="flex items-center justify-between text-sm py-1">
                  <span>Składka zdrowotna</span>
                  <strong>{formatPLN(summary?.monthly?.zus?.health ?? 0)}</strong>
                </div>
                <div className="flex items-center justify-between text-sm py-1">
                  <span>PIT narastająco (YTD)</span>
                  <strong>{formatPLN(summary?.ytd?.pitDue ?? 0)}</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Składki ZUS</CardTitle>
                <CardDescription>Składki społeczne + zdrowotna ({ZUS_PROFILE_LABEL[(summary?.config?.zusProfile as ZusProfile) ?? 'FULL']})</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between"><span>Emerytalna</span><strong>{formatPLN(summary?.monthly?.zus?.social?.retirement ?? 0)}</strong></div>
                <div className="flex items-center justify-between"><span>Rentowa</span><strong>{formatPLN(summary?.monthly?.zus?.social?.disability ?? 0)}</strong></div>
                <div className="flex items-center justify-between"><span>Chorobowa</span><strong>{formatPLN(summary?.monthly?.zus?.social?.sickness ?? 0)}</strong></div>
                <div className="flex items-center justify-between"><span>Wypadkowa</span><strong>{formatPLN(summary?.monthly?.zus?.social?.accident ?? 0)}</strong></div>
                <div className="flex items-center justify-between"><span>Fundusz Pracy</span><strong>{formatPLN(summary?.monthly?.zus?.social?.laborFund ?? 0)}</strong></div>
                <div className="border-t pt-2 flex items-center justify-between"><span>Razem społeczne (miesiąc)</span><strong>{formatPLN(summary?.monthly?.zus?.socialTotal ?? 0)}</strong></div>
                <div className="flex items-center justify-between"><span>Zdrowotna (miesiąc)</span><strong>{formatPLN(summary?.monthly?.zus?.health ?? 0)}</strong></div>
                <div className="border-t pt-2 flex items-center justify-between"><span>Społeczne YTD</span><strong>{formatPLN(summary?.ytd?.zus?.socialTotal ?? 0)}</strong></div>
                <div className="flex items-center justify-between"><span>Zdrowotna YTD</span><strong>{formatPLN(summary?.ytd?.zus?.healthTotal ?? 0)}</strong></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Podsumowanie narastająco (YTD)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Przychód YTD</p>
                <p className="font-semibold">{formatPLN(summary?.ytd?.revenue ?? 0)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Koszty YTD</p>
                <p className="font-semibold">{formatPLN(summary?.ytd?.costs ?? 0)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">PIT YTD</p>
                <p className="font-semibold">{formatPLN(summary?.ytd?.pitDue ?? 0)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Łącznie YTD</p>
                <p className="font-semibold text-primary">{formatPLN(summary?.ytd?.totalDue ?? 0)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Założenia kalkulatora</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {(summary.assumptions ?? []).map((a: string, idx: number) => (
                <p key={idx}>• {a}</p>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
