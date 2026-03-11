'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Receipt, CheckCircle, AlertTriangle, Wallet } from 'lucide-react';
import type { IBill } from '@shared/models';
import { formatPLN, computeMonthlyEquivalent } from '../utils';

interface Props {
  bills: IBill[];
}

export function BillSummary({ bills }: Props) {
  const activeBills = bills.filter((b) => b.isActive);
  const paidCount = activeBills.filter((b) => b.status === 'PAID').length;
  const partiallyPaidCount = activeBills.filter((b) => b.status === 'PARTIALLY_PAID').length;
  const overdueCount = activeBills.filter((b) => b.status === 'OVERDUE').length;
  const totalMonthly = activeBills.reduce(
    (sum, b) => sum + computeMonthlyEquivalent(b.amount, b.frequency),
    0,
  );

  const items = [
    {
      label: 'Rachunki',
      value: `${activeBills.length}`,
      icon: <Receipt className="h-4 w-4" />,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Opłacone',
      value: `${paidCount} / ${activeBills.length}`,
      subtext: partiallyPaidCount > 0 ? `(${partiallyPaidCount} częściowo)` : undefined,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Zaległe',
      value: `${overdueCount}`,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      bg: overdueCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted/50',
    },
    {
      label: 'Suma miesięczna',
      value: formatPLN(Math.round(totalMonthly * 100) / 100),
      icon: <Wallet className="h-4 w-4" />,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="py-3">
          <CardContent className="px-4 py-0">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                {item.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold leading-tight">{item.value}</p>
                {'subtext' in item && item.subtext && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">{item.subtext}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
