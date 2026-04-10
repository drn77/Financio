'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  templateId: string;
}

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

function formatPeriodLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`;
}

export function PeriodHistory({ templateId }: Props) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBillingPeriodHistory(templateId, 6)
      .then((data) => setPeriods(data))
      .catch(() => setPeriods([]))
      .finally(() => setLoading(false));
  }, [templateId]);

  if (loading || periods.length === 0) return null;

  const maxAmount = Math.max(...periods.map(p => p.totalAmount), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Porównanie okresów
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {periods.map((period: any, i: number) => {
          const pct = (period.totalAmount / maxAmount) * 100;
          const isOverBudget = period.budgetAmount && period.totalAmount > period.budgetAmount;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {formatPeriodLabel(period.periodStart, period.periodEnd)}
                </span>
                <span className="font-medium">{formatPLN(period.totalAmount)}</span>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    i === 0 ? 'bg-primary' : isOverBudget ? 'bg-red-400' : 'bg-primary/50'
                  }`}
                  style={{ width: `${pct}%` }}
                />
                {period.budgetAmount && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive/50"
                    style={{ left: `${Math.min(100, (period.budgetAmount / maxAmount) * 100)}%` }}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{period.recordCount} wpisów</span>
                {period.budgetAmount && (
                  <span className={isOverBudget ? 'text-red-500' : ''}>
                    budżet: {formatPLN(period.budgetAmount)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
