'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Hash, PieChart } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RecordRow {
  id?: string;
  data: Record<string, any>;
}

interface Props {
  records: RecordRow[];
  categories: any[];
}

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

export function ExpenseSummary({ records, categories }: Props) {
  const stats = useMemo(() => {
    let totalAmount = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    const byCategory: Record<string, { amount: number; count: number; color: string }> = {};

    const categoryColorMap: Record<string, string> = {};
    for (const cat of categories) {
      categoryColorMap[cat.name] = cat.color || '#888';
    }

    for (const row of records) {
      const amountVal = row.data.col_amount;
      const amount = typeof amountVal === 'object' ? Number(amountVal?.amount ?? 0) : Number(amountVal ?? 0);

      if (amount > 0) totalAmount += amount;

      if (row.data.col_paid) {
        paidCount++;
      } else {
        unpaidCount++;
      }

      const cats: string[] = Array.isArray(row.data.col_category) ? row.data.col_category : [];
      for (const catName of cats) {
        if (!byCategory[catName]) {
          byCategory[catName] = { amount: 0, count: 0, color: categoryColorMap[catName] || '#888' };
        }
        byCategory[catName].amount += amount;
        byCategory[catName].count++;
      }
    }

    const topCategories = Object.entries(byCategory)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalAmount,
      averageAmount: records.length > 0 ? totalAmount / records.length : 0,
      count: records.length,
      paidCount,
      unpaidCount,
      topCategories,
    };
  }, [records, categories]);

  if (records.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Suma</p>
            <p className="text-lg font-bold">{formatPLN(stats.totalAmount)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Średnia</p>
            <p className="text-lg font-bold">{formatPLN(stats.averageAmount)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-green-500/10 p-2">
            <Hash className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Wpisów</p>
            <p className="text-lg font-bold">{stats.count}</p>
            <p className="text-xs text-muted-foreground">
              {stats.paidCount} opł. / {stats.unpaidCount} nieopł.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <PieChart className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground">Top kategorie</p>
          </div>
          <div className="space-y-1">
            {stats.topCategories.length === 0 && (
              <p className="text-xs text-muted-foreground">Brak</p>
            )}
            {stats.topCategories.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </span>
                <span className="font-medium shrink-0 ml-2">{formatPLN(cat.amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
