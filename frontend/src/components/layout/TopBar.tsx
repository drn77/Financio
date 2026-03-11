'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wallet, TrendingDown, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ISummary {
  balance: number;
  balanceAfterPlanned: number;
  incurredCosts: number;
  plannedCosts: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
  }).format(value);
}

function useSummary() {
  const [summary, setSummary] = useState<ISummary | null>(null);

  const refresh = useCallback(() => {
    api.getDashboardSummary().then(setSummary).catch(() => {});
  }, []);

  useEffect(() => {
    // Initial fetch via interval with 0 delay to avoid sync setState in effect
    const immediate = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 60_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [refresh]);

  return summary;
}

export function TopBar() {
  const summary = useSummary();

  if (!summary) {
    return (
      <div className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm animate-pulse" />
    );
  }

  return (
    <div className="sticky top-0 z-30 border-b border-border/50 bg-card/80 backdrop-blur-sm lg:top-0">
      {/* Mobile: scrollable horizontal row */}
      <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto no-scrollbar lg:gap-6 lg:px-6 lg:py-3">
        {/* Balance */}
        <div className="flex items-center gap-2.5 min-w-fit">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className={cn(
              'text-sm font-bold tabular-nums tracking-tight',
              summary.balance >= 0 ? 'text-emerald-500' : 'text-red-500',
            )}>
              {formatCurrency(summary.balance)}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              Po planowanych: {' '}
              <span className={cn(
                'font-medium',
                summary.balanceAfterPlanned >= 0 ? 'text-muted-foreground' : 'text-red-400',
              )}>
                {formatCurrency(summary.balanceAfterPlanned)}
              </span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px shrink-0 bg-border/60 hidden sm:block" />

        {/* Incurred costs */}
        <div className="flex items-center gap-2.5 min-w-fit">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-500">
            <TrendingDown className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
              {formatCurrency(summary.incurredCosts)}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              Poniesione koszty
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px shrink-0 bg-border/60 hidden sm:block" />

        {/* Planned costs */}
        <div className="flex items-center gap-2.5 min-w-fit">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
              {formatCurrency(summary.plannedCosts)}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              Planowane koszty
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
