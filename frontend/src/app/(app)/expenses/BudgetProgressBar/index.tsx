'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendingDown, AlertTriangle } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RecordRow {
  id?: string;
  data: Record<string, any>;
}

interface Props {
  records: RecordRow[];
  budgetAmount: number;
  periodProgress: number; // 0-1
}

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

export function BudgetProgressBar({ records, budgetAmount, periodProgress }: Props) {
  const totalSpent = useMemo(() => {
    let sum = 0;
    for (const row of records) {
      const amountVal = row.data.col_amount;
      const amount = typeof amountVal === 'object' ? Number(amountVal?.amount ?? 0) : Number(amountVal ?? 0);
      if (amount > 0) sum += amount;
    }
    return Math.round(sum * 100) / 100;
  }, [records]);

  const spentPercent = budgetAmount > 0 ? Math.min(100, (totalSpent / budgetAmount) * 100) : 0;
  const remaining = budgetAmount - totalSpent;
  const isOverBudget = totalSpent > budgetAmount;
  const isNearBudget = spentPercent > 80 && !isOverBudget;

  // Expected spending based on period progress
  const expectedSpent = budgetAmount * periodProgress;
  const isAhead = totalSpent > expectedSpent * 1.1; // spending faster than expected

  let barColor = 'bg-green-500';
  if (isOverBudget) barColor = 'bg-red-500';
  else if (isNearBudget) barColor = 'bg-yellow-500';
  else if (isAhead) barColor = 'bg-orange-400';

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Budżet na okres</span>
          </div>
          <span className="font-medium">
            {formatPLN(totalSpent)} / {formatPLN(budgetAmount)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, spentPercent)}%` }}
          />
          {/* Expected marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/30"
            style={{ left: `${Math.min(100, periodProgress * 100)}%` }}
            title={`Oczekiwane: ${formatPLN(expectedSpent)}`}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(spentPercent)}% budżetu</span>
          {isOverBudget ? (
            <span className="flex items-center gap-1 text-red-500 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Przekroczono o {formatPLN(-remaining)}
            </span>
          ) : isNearBudget ? (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <TrendingDown className="h-3 w-3" />
              Pozostało {formatPLN(remaining)}
            </span>
          ) : (
            <span>Pozostało {formatPLN(remaining)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
