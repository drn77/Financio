'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

const COLORS = ['#2ECC71', '#3498DB', '#F1C40F', '#9B59B6', '#E67E22', '#E74C3C', '#1ABC9C', '#34495E'];

export default function StatisticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('current');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getDashboard();
      setData(d);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!data) {
    return <div className="text-center py-8 text-muted-foreground">Brak danych do wyświetlenia</div>;
  }

  const categoryData = Object.entries(data.expensesByCategory ?? {}).map(([name, value]) => ({
    name,
    value: Number(value),
  })).sort((a, b) => b.value - a.value);

  const personData = Object.entries(data.expensesByPerson ?? {}).map(([name, value]) => ({
    name,
    value: Number(value),
  })).sort((a, b) => b.value - a.value);

  const totalExpenses = categoryData.reduce((s, d) => s + d.value, 0);
  const totalIncome = Number(data.monthlyIncome ?? 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  // Trend data (mock based on current month for MVP)
  const trendData = [
    { month: 'Sty', wydatki: totalExpenses * 0.85, przychody: totalIncome * 0.9 },
    { month: 'Lut', wydatki: totalExpenses * 0.92, przychody: totalIncome * 0.95 },
    { month: 'Mar', wydatki: totalExpenses * 1.1, przychody: totalIncome },
    { month: 'Kwi', wydatki: totalExpenses * 0.78, przychody: totalIncome * 1.05 },
    { month: 'Maj', wydatki: totalExpenses * 0.95, przychody: totalIncome },
    { month: 'Cze', wydatki: totalExpenses, przychody: totalIncome },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Statystyki</h1>
          <p className="text-sm text-muted-foreground">Analiza finansów</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Ten miesiąc</SelectItem>
            <SelectItem value="last">Poprzedni miesiąc</SelectItem>
            <SelectItem value="quarter">Kwartał</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Przychody</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-green-600">{formatPLN(totalIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Wydatki</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-red-500">{formatPLN(totalExpenses)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Bilans</CardTitle></CardHeader>
          <CardContent><p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPLN(totalIncome - totalExpenses)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stopa oszczędności</CardTitle></CardHeader>
          <CardContent><p className={`text-xl font-bold ${savingsRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>{savingsRate.toFixed(1)}%</p></CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Trend przychodów i wydatków</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatPLN(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="przychody" name="Przychody" stroke="#2ECC71" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="wydatki" name="Wydatki" stroke="#E74C3C" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Bar Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Wydatki wg kategorii</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak danych</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `${(v/1).toFixed(0)}`} />
                  <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatPLN(Number(v))} />
                  <Bar dataKey="value" name="Kwota" radius={[0, 4, 4, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Person Pie Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Wydatki wg osoby</CardTitle></CardHeader>
          <CardContent>
            {personData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak danych</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={personData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {personData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatPLN(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Expenses Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Największe kategorie wydatków</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categoryData.slice(0, 5).map((c, i) => {
              const pct = totalExpenses > 0 ? (c.value / totalExpenses) * 100 : 0;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">{formatPLN(c.value)}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
