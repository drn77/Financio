'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, TrendingDown, Minus, Calendar, CreditCard, Trash2 } from 'lucide-react';
import type { IBill, IBillPayment } from '@shared/models';
import { formatPLN, formatDate } from '../utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: IBill | null;
  payments: IBillPayment[];
  isLoading: boolean;
  onPay?: (bill: IBill) => void;
  onDeletePayment?: (billId: string, paymentId: string) => void;
}

export function PaymentHistoryDialog({
  open,
  onOpenChange,
  bill,
  payments,
  isLoading,
  onPay,
  onDeletePayment,
}: Props) {
  const stats = useMemo(() => {
    if (payments.length === 0) {
      return { avg: 0, min: 0, max: 0, total: 0, trend: 0 };
    }

    const amounts = payments.map((p) => p.amount);
    const total = amounts.reduce((s, a) => s + a, 0);
    const avg = total / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    let trend = 0;

    if (payments.length >= 2) {
      const recent = payments[0].amount;
      trend = ((recent - avg) / avg) * 100;
    }

    return {
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      total: Math.round(total * 100) / 100,
      trend: Math.round(trend * 10) / 10,
    };
  }, [payments]);

  const _getTrendIcon = () => {
    if (stats.trend > 5) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (stats.trend < -5) return <TrendingDown className="h-4 w-4 text-green-500" />;

    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const _getTrendLabel = () => {
    if (stats.trend > 5) return `+${stats.trend}% powyżej średniej`;
    if (stats.trend < -5) return `${stats.trend}% poniżej średniej`;

    return 'W normie';
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historia płatności — {bill.name}</DialogTitle>
        </DialogHeader>

        {/* Payment progress */}
        {bill.isActive && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Postęp opłat w tym miesiącu</span>
              <span className="font-medium">
                {formatPLN(bill.paidAmount ?? 0)} / {formatPLN(bill.amount)}
              </span>
            </div>
            <Progress
              value={Math.min(((bill.paidAmount ?? 0) / bill.amount) * 100, 100)}
              className="h-2"
            />
            {bill.status !== 'PAID' && onPay && (
              <Button size="sm" className="mt-1 w-full" onClick={() => onPay(bill)}>
                <CreditCard className="mr-1.5 h-4 w-4" />
                {(bill.paidAmount ?? 0) > 0
                  ? `Dopłać ${formatPLN(bill.remainingAmount ?? bill.amount)}`
                  : 'Opłać rachunek'}
              </Button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Brak historii płatności
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">Średnia</span>
                <p className="text-lg font-semibold">{formatPLN(stats.avg)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">Suma</span>
                <p className="text-lg font-semibold">{formatPLN(stats.total)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">Min / Max</span>
                <p className="text-sm font-medium">
                  {formatPLN(stats.min)} — {formatPLN(stats.max)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">Trend</span>
                <div className="flex items-center gap-1.5">
                  {_getTrendIcon()}
                  <span className="text-sm font-medium">{_getTrendLabel()}</span>
                </div>
              </div>
            </div>

            <Separator />

            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {payments.map((payment, index) => {
                  const diff =
                    index < payments.length - 1
                      ? payment.amount - payments[index + 1].amount
                      : 0;

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">
                            {formatDate(payment.dueDate)}
                          </span>
                          {payment.notes && (
                            <p className="text-xs text-muted-foreground">{payment.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatPLN(payment.amount)}</span>
                        {diff !== 0 && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              diff > 0
                                ? 'border-red-200 text-red-600 dark:border-red-800 dark:text-red-400'
                                : 'border-green-200 text-green-600 dark:border-green-800 dark:text-green-400'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {formatPLN(diff)}
                          </Badge>
                        )}
                        {onDeletePayment && bill && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeletePayment(bill.id, payment.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
