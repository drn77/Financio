'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  PiggyBank,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Link from 'next/link';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DashboardData {
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
  expensesByCategory: { category: string; amount: number }[];
  expensesByPerson: { person: string; amount: number }[];
  upcomingBills: { id: string; name: string; amount: number; dueDay: number; nextDueDate: string; isPaidThisMonth: boolean; paidAmount: number; remainingAmount: number; status: string }[];
  recentRecords: { id: string; data: any; createdAt: string }[];
}

const CHART_COLORS = [
  'oklch(0.72 0.19 155)',  // green
  'oklch(0.55 0.18 250)',  // blue
  'oklch(0.65 0.22 25)',   // red
  'oklch(0.75 0.18 75)',   // amber
  'oklch(0.65 0.20 320)',  // purple
  'oklch(0.70 0.15 180)',  // teal
  'oklch(0.70 0.18 35)',   // orange
  'oklch(0.50 0.15 250)',  // dark blue
  'oklch(0.60 0.15 155)',  // dark green
  'oklch(0.60 0.18 320)',  // magenta
];

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const result = await api.getDashboard();
      setData(result as DashboardData);
    } catch {
      setData({
        monthlyIncome: 0,
        monthlyExpenses: 0,
        balance: 0,
        expensesByCategory: [],
        expensesByPerson: [],
        upcomingBills: [],
        recentRecords: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const currentMonth = monthNames[new Date().getMonth()];

  const savings = data.monthlyIncome - data.monthlyExpenses;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Cześć, {user?.firstName ?? user?.username}!
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Podsumowanie finansów &mdash; {currentMonth} {new Date().getFullYear()}
          </p>
        </div>
        <AddExpenseDialog onExpenseAdded={loadDashboard} />
      </div>

      {/* Stats Cards — 4 cards like the reference */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Balance */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bilans</p>
            <p className={`text-lg font-bold sm:text-2xl mt-1 ${data.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatPLN(data.balance)}
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Przychody</p>
            <p className="text-lg font-bold sm:text-2xl mt-1 text-primary">
              {formatPLN(data.monthlyIncome)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <ArrowUpRight className="h-3 w-3 text-primary" />
              Ten miesiąc
            </div>
          </CardContent>
        </Card>

        {/* Savings */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <PiggyBank className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Oszczędności</p>
            <p className={`text-lg font-bold sm:text-2xl mt-1 ${savings >= 0 ? 'text-blue-500' : 'text-destructive'}`}>
              {formatPLN(savings)}
            </p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wydatki</p>
            <p className="text-lg font-bold sm:text-2xl mt-1 text-destructive">
              {formatPLN(data.monthlyExpenses)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <ArrowDownRight className="h-3 w-3 text-destructive" />
              Ten miesiąc
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expenses by Category - Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Wydatki wg kategorii</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.expensesByCategory} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                  <XAxis type="number" tickFormatter={(v) => `${v} zł`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    formatter={(v) => formatPLN(Number(v))}
                    contentStyle={{
                      backgroundColor: 'oklch(0.17 0.02 255)',
                      border: '1px solid oklch(1 0 0 / 10%)',
                      borderRadius: '8px',
                      color: 'oklch(0.93 0.005 250)',
                    }}
                  />
                  <Bar dataKey="amount" fill="oklch(0.72 0.19 155)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                Brak danych do wyświetlenia
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Person - Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Wydatki wg osoby</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expensesByPerson.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={280} className="sm:max-w-[60%]">
                  <PieChart>
                    <Pie
                      data={data.expensesByPerson}
                      dataKey="amount"
                      nameKey="person"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      strokeWidth={2}
                    >
                      {data.expensesByPerson.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(v) => formatPLN(Number(v))}
                      contentStyle={{
                        backgroundColor: 'oklch(0.17 0.02 255)',
                        border: '1px solid oklch(1 0 0 / 10%)',
                        borderRadius: '8px',
                        color: 'oklch(0.93 0.005 250)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap sm:flex-col gap-2 justify-center">
                  {data.expensesByPerson.map((item, i) => (
                    <div key={item.person} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-muted-foreground text-xs sm:text-sm">{item.person}</span>
                      <span className="font-medium text-xs sm:text-sm">{formatPLN(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                Brak danych do wyświetlenia
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming Bills */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Nadchodzące rachunki
              </CardTitle>
              <Link href="/bills" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Pokaż wszystkie <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.upcomingBills.length > 0 ? (
              <div className="space-y-2">
                {data.upcomingBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between rounded-xl border bg-card p-3 transition-colors hover:bg-accent/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{bill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bill.dueDay}. dzień miesiąca
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-semibold text-sm">{formatPLN(bill.amount)}</span>
                        {bill.status === 'PARTIALLY_PAID' && (
                          <p className="text-xs text-muted-foreground">
                            wpłacono {formatPLN(bill.paidAmount)}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={bill.status === 'PAID' ? 'default' : bill.status === 'PARTIALLY_PAID' ? 'outline' : 'destructive'}
                        className={`text-xs ${bill.status === 'PARTIALLY_PAID' ? 'border-orange-400 text-orange-600 dark:border-orange-600 dark:text-orange-400' : ''}`}
                      >
                        {bill.status === 'PAID' ? 'Opłacony' : bill.status === 'PARTIALLY_PAID' ? 'Częściowo' : 'Do zapłaty'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Brak rachunków do wyświetlenia</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Records */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Ostatnie wpisy</CardTitle>
              <Link href="/expenses" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Pokaż wszystkie <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentRecords.length > 0 ? (
              <div className="space-y-2">
                {data.recentRecords.slice(0, 6).map((record) => {
                  const d = record.data as any;
                  return (
                    <div key={record.id} className="flex items-center justify-between rounded-xl border bg-card p-3 transition-colors hover:bg-accent/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{d.col_name || 'Bez nazwy'}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.col_date ? new Date(d.col_date).toLocaleDateString('pl-PL') : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold text-sm ${d.col_type === 'Przychód' ? 'text-primary' : 'text-foreground'}`}>
                          {d.col_amount?.amount ? formatPLN(d.col_amount.amount) : '-'}
                        </span>
                        {d.col_category && (
                          <p className="text-xs text-muted-foreground">{
                            Array.isArray(d.col_category) ? d.col_category.join(', ') : d.col_category
                          }</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Brak wpisów &mdash; dodaj pierwszy w tabeli Wydatki
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
