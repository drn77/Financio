'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
  LineChart, Line,
} from 'recharts';
import { Eye, EyeOff } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

const COLORS = ['#2ECC71', '#3498DB', '#F1C40F', '#9B59B6', '#E67E22', '#E74C3C', '#1ABC9C', '#34495E'];
const HISTORY_PAGE_SIZE = 12;

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);
  const [taxByMonth, setTaxByMonth] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showIncomeHistory, setShowIncomeHistory] = useState(false);
  const [showExpenseHistory, setShowExpenseHistory] = useState(false);
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [seriesVisibility, setSeriesVisibility] = useState({
    income: true,
    expenses: true,
    balance: true,
    savings: true,
    taxes: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statisticsData, config] = await Promise.all([
        api.getDashboardStatistics(),
        api.getDashboardConfig(),
      ]);

      setStats(statisticsData);
      setDashboardConfig(config);

      const months: Array<{ year: number; month: number; monthKey: string }> = statisticsData?.months ?? [];
      if (months.length > 0) {
        const taxEntries = await Promise.all(
          months.map(async (monthInfo) => {
            try {
              const taxSummary = await api.getTaxSummary(monthInfo.month, monthInfo.year);
              return [monthInfo.monthKey, Number(taxSummary?.monthly?.total ?? 0)] as const;
            } catch {
              return [monthInfo.monthKey, 0] as const;
            }
          }),
        );

        const taxMap: Record<string, number> = {};
        for (const [monthKey, value] of taxEntries) taxMap[monthKey] = value;
        setTaxByMonth(taxMap);
      } else {
        setTaxByMonth({});
      }
    } catch {
      setStats(null);
      setDashboardConfig(null);
      setTaxByMonth({});
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onCategoryFieldChange = useCallback(async (value: string) => {
    if (!dashboardConfig) return;
    setLoadingConfig(true);
    try {
      await api.updateDashboardConfig({ categoryFieldId: value === '__none' ? null : value });
      await loadData();
    } finally {
      setLoadingConfig(false);
    }
  }, [dashboardConfig, loadData]);

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!stats) {
    return <div className="text-center py-8 text-muted-foreground">Brak danych do wyświetlenia</div>;
  }

  const months = (stats.months ?? []) as any[];
  const categoryData = (stats.categoryTotals ?? []).map((item: any) => ({
    name: String(item.name),
    value: Number(item.amount ?? 0),
  }));

  const averageIncome = Number(stats.averageIncome ?? 0);
  const averageExpenses = Number(stats.averageExpenses ?? 0);
  const averageBalance = Number(stats.averageBalance ?? 0);
  const averageSavings = Number(stats.averageSavings ?? 0);
  const averageSavingsRate = Number(stats.averageSavingsRate ?? 0);
  const medianMonthlyExpenses = Number(stats.medianMonthlyExpenses ?? 0);
  const incomeStdDev = Number(stats.incomeStdDev ?? 0);
  const expensesStdDev = Number(stats.expensesStdDev ?? 0);
  const balanceForecast = {
    nextMonth: Number(stats.balanceForecast?.nextMonth ?? 0),
    inTwoMonths: Number(stats.balanceForecast?.inTwoMonths ?? 0),
    inThreeMonths: Number(stats.balanceForecast?.inThreeMonths ?? 0),
  };
  const topGrowthCategories = (stats.topGrowthCategories ?? []) as Array<{
    category: string;
    currentAmount: number;
    previousAmount: number;
    delta: number;
    growthRate: number;
  }>;
  const fixedVsVariable = {
    fixedAmount: Number(stats.fixedVsVariable?.fixedAmount ?? 0),
    variableAmount: Number(stats.fixedVsVariable?.variableAmount ?? 0),
    fixedShare: Number(stats.fixedVsVariable?.fixedShare ?? 0),
    variableShare: Number(stats.fixedVsVariable?.variableShare ?? 0),
  };
  const savingsEffectiveness = {
    averageEffectiveness: Number(stats.savingsEffectiveness?.averageEffectiveness ?? 0),
    monthly: (stats.savingsEffectiveness?.monthly ?? []) as Array<{
      monthKey: string;
      monthLabel: string;
      planned: number;
      actual: number;
      effectiveness: number;
    }>,
  };

  const taxSeries = useMemo(() => {
    const source = (stats.series ?? []) as any[];
    return source.map((point) => {
      const tax = Number(taxByMonth[point.monthKey] ?? 0);
      return {
        ...point,
        taxes: tax,
      };
    });
  }, [stats.series, taxByMonth]);

  const averageTaxes = useMemo(() => {
    const values = Object.values(taxByMonth);
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
  }, [taxByMonth]);

  const averageIncomeAfterTaxes = averageIncome - averageTaxes;

  const incomeHistoryPageCount = Math.max(1, Math.ceil(months.length / HISTORY_PAGE_SIZE));
  const expenseHistoryPageCount = Math.max(1, Math.ceil(months.length / HISTORY_PAGE_SIZE));
  const incomePageItems = paginate(months, incomePage, HISTORY_PAGE_SIZE);
  const expensePageItems = paginate(months, expensePage, HISTORY_PAGE_SIZE);

  const toggleSeries = (key: keyof typeof seriesVisibility) => {
    setSeriesVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Statystyki</h1>
          <p className="text-sm text-muted-foreground">Przegląd średnich miesięcznych, bilansu i trendów</p>
        </div>
        <Select
          value={dashboardConfig?.categoryFieldId ?? '__none'}
          onValueChange={onCategoryFieldChange}
          disabled={loadingConfig}
        >
          <SelectTrigger className="w-[280px]"><SelectValue placeholder="Pole kategorii" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Automatyczne (col_category)</SelectItem>
            {(dashboardConfig?.availableCategoryFields ?? []).map((field: any) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name}{field.tagGroupName ? ` (${field.tagGroupName})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Średnie przychody</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xl font-bold text-green-600">{formatPLN(averageIncome)}</p>
            <Button variant="outline" size="sm" onClick={() => { setIncomePage(1); setShowIncomeHistory(true); }}>
              Historia przychodów
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Średnie wydatki</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xl font-bold text-red-500">{formatPLN(averageExpenses)}</p>
            <Button variant="outline" size="sm" onClick={() => { setExpensePage(1); setShowExpenseHistory(true); }}>
              Historia wydatków
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Średni bilans</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className={`text-xl font-bold ${averageBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPLN(averageBalance)}</p>
            <p className="text-xs text-muted-foreground">
              Oszczędności: <span className="font-medium text-foreground">{formatPLN(averageSavings)}</span> ({averageSavingsRate.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Podatki</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{formatPLN(averageIncome)}</p>
            <p className="text-muted-foreground">- {formatPLN(averageTaxes)}</p>
            <p className="font-semibold text-primary">= {formatPLN(averageIncomeAfterTaxes)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mediana wydatków</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{formatPLN(medianMonthlyExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Zmienność przychodów</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{formatPLN(incomeStdDev)}</p>
            <p className="text-xs text-muted-foreground">Odchylenie standardowe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Zmienność wydatków</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{formatPLN(expensesStdDev)}</p>
            <p className="text-xs text-muted-foreground">Odchylenie standardowe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Skuteczność oszczędzania</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{savingsEffectiveness.averageEffectiveness.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Średnio plan vs wykonanie</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-base">Prognoza bilansu (1-3 mies.)</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Następny miesiąc</p>
              <p className={`text-lg font-semibold ${balanceForecast.nextMonth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatPLN(balanceForecast.nextMonth)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Za 2 miesiące</p>
              <p className={`text-lg font-semibold ${balanceForecast.inTwoMonths >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatPLN(balanceForecast.inTwoMonths)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Za 3 miesiące</p>
              <p className={`text-lg font-semibold ${balanceForecast.inThreeMonths >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatPLN(balanceForecast.inThreeMonths)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Stałe vs zmienne</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>Stałe</span><span className="font-medium">{formatPLN(fixedVsVariable.fixedAmount)} ({fixedVsVariable.fixedShare.toFixed(1)}%)</span></div>
            <div className="flex items-center justify-between"><span>Zmienne</span><span className="font-medium">{formatPLN(fixedVsVariable.variableAmount)} ({fixedVsVariable.variableShare.toFixed(1)}%)</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trend miesięczny (interaktywny)</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            {([
              { key: 'income' as const, label: 'Przychody', color: '#16a34a' },
              { key: 'expenses' as const, label: 'Wydatki', color: '#dc2626' },
              { key: 'balance' as const, label: 'Bilans', color: '#2563eb' },
              { key: 'savings' as const, label: 'Oszczędności', color: '#0d9488' },
              { key: 'taxes' as const, label: 'Podatki', color: '#9333ea' },
            ]).map((entry) => (
              <Button
                key={entry.key}
                size="sm"
                variant={seriesVisibility[entry.key] ? 'secondary' : 'outline'}
                className="h-7 gap-1"
                onClick={() => toggleSeries(entry.key)}
              >
                {seriesVisibility[entry.key] ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span style={{ color: entry.color }}>{entry.label}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={taxSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="monthLabel" />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatPLN(Number(v))} />
              {seriesVisibility.income && <Line type="monotone" dataKey="income" name="Przychody" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />}
              {seriesVisibility.expenses && <Line type="monotone" dataKey="expenses" name="Wydatki" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />}
              {seriesVisibility.balance && <Line type="monotone" dataKey="balance" name="Bilans" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />}
              {seriesVisibility.savings && <Line type="monotone" dataKey="savings" name="Oszczędności" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />}
              {seriesVisibility.taxes && <Line type="monotone" dataKey="taxes" name="Podatki" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} />}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Wydatki wg kategorii</CardTitle></CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Brak danych kategorii. Ustaw mapowanie pola kategorii powyżej.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={categoryData.slice(0, 12)} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatPLN(Number(value))} />
                <Bar dataKey="value" name="Kwota" radius={[0, 4, 4, 0]}>
                  {categoryData.slice(0, 12).map((item: { name: string; value: number }, index: number) => (
                    <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 5 wzrostów kategorii m/m</CardTitle></CardHeader>
          <CardContent>
            {topGrowthCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Za mało danych do porównania miesiąc do miesiąca.</p>
            ) : (
              <div className="space-y-2">
                {topGrowthCategories.map((item) => (
                  <div key={item.category} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{item.category}</p>
                      <p className="text-sm text-red-500">+{item.growthRate.toFixed(1)}%</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPLN(item.previousAmount)} {'->'} {formatPLN(item.currentAmount)} (delta: {formatPLN(item.delta)})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Oszczędzanie: plan vs wykonanie</CardTitle></CardHeader>
          <CardContent>
            {savingsEffectiveness.monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak danych o planie oszczędzania.</p>
            ) : (
              <div className="space-y-2">
                {savingsEffectiveness.monthly.slice(0, 6).map((item) => (
                  <div key={item.monthKey} className="rounded border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.monthLabel}</span>
                      <span className={item.effectiveness >= 100 ? 'text-green-600' : 'text-amber-600'}>{item.effectiveness.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Plan: {formatPLN(item.planned)} | Wykonanie: {formatPLN(item.actual)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showIncomeHistory} onOpenChange={setShowIncomeHistory}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historia przychodów</DialogTitle>
            <DialogDescription>Wszystkie miesiące z paginacją</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {incomePageItems.map((month) => (
              <div key={month.monthKey} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="text-sm">{month.monthLabel}</span>
                <span className="font-medium text-green-600">{formatPLN(Number(month.income ?? 0))}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" disabled={incomePage <= 1} onClick={() => setIncomePage((p) => p - 1)}>Poprzednia</Button>
            <span className="text-xs text-muted-foreground">{incomePage} / {incomeHistoryPageCount}</span>
            <Button variant="outline" size="sm" disabled={incomePage >= incomeHistoryPageCount} onClick={() => setIncomePage((p) => p + 1)}>Następna</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpenseHistory} onOpenChange={setShowExpenseHistory}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historia wydatków</DialogTitle>
            <DialogDescription>Lista miesięcy z sumą wydatków</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {expensePageItems.map((month) => (
              <div key={month.monthKey} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="text-sm">{month.monthLabel}</span>
                <span className="font-medium text-red-500">{formatPLN(Number(month.expenses ?? 0))}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" disabled={expensePage <= 1} onClick={() => setExpensePage((p) => p - 1)}>Poprzednia</Button>
            <span className="text-xs text-muted-foreground">{expensePage} / {expenseHistoryPageCount}</span>
            <Button variant="outline" size="sm" disabled={expensePage >= expenseHistoryPageCount} onClick={() => setExpensePage((p) => p + 1)}>Następna</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
