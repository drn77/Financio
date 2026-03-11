'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CreditCard,
  Trash2,
  MoreVertical,
  Pencil,
  Clock,
  History,
  AlertTriangle,
  Zap,
  Building2,
} from 'lucide-react';
import type { IBill, BillStatus, PaymentType } from '../model';
import type { ICategory } from '@shared/models';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  FREQUENCY_LABELS,
  PAYMENT_TYPE_LABELS,
} from '../model';
import { formatPLN, getDaysUntilDue } from '../utils';

interface Props {
  bill: IBill;
  categories?: ICategory[];
  onPay: (bill: IBill) => void;
  onEdit: (bill: IBill) => void;
  onDelete: (bill: IBill) => void;
  onViewHistory: (bill: IBill) => void;
  onToggleActive?: (bill: IBill) => void;
}

const PAYMENT_TYPE_ICONS: Record<PaymentType, React.ReactNode> = {
  MANUAL: <CreditCard className="h-3.5 w-3.5" />,
  AUTO_PAY: <Zap className="h-3.5 w-3.5" />,
  DIRECT_DEBIT: <Building2 className="h-3.5 w-3.5" />,
};

export function BillCard({ bill, categories, onPay, onEdit, onDelete, onViewHistory, onToggleActive }: Props) {
  const status = (bill.status ?? 'UPCOMING') as BillStatus;
  const daysUntil = getDaysUntilDue(bill.dueDay);
  const isPaid = status === 'PAID';
  const isPartiallyPaid = status === 'PARTIALLY_PAID';
  const isOverdue = status === 'OVERDUE';
  const budgetExceeded =
    bill.budgetLimit != null && bill.amount > bill.budgetLimit;

  const _handlePay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPay(bill);
    },
    [bill, onPay],
  );

  const _handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(bill);
    },
    [bill, onEdit],
  );

  const _handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(bill);
    },
    [bill, onDelete],
  );

  const _handleViewHistory = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onViewHistory(bill);
    },
    [bill, onViewHistory],
  );

  return (
    <Card
      className={`relative transition-shadow hover:shadow-md ${
        isOverdue ? 'border-red-300 dark:border-red-800' : ''
      } ${!bill.isActive ? 'opacity-60' : ''}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{bill.name}</span>
            {!bill.isActive && (
              <Badge variant="outline" className="text-xs">
                Nieaktywny
              </Badge>
            )}
          </CardTitle>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge className={`text-xs ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]}
            </Badge>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-xs">
                  {PAYMENT_TYPE_ICONS[bill.paymentType]}
                  {PAYMENT_TYPE_LABELS[bill.paymentType]}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Typ płatności</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={_handleEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edytuj
            </DropdownMenuItem>
            <DropdownMenuItem onClick={_handleViewHistory}>
              <History className="mr-2 h-4 w-4" />
              Historia płatności
            </DropdownMenuItem>
            {onToggleActive && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleActive(bill);
                }}
              >
                {bill.isActive ? '⏸ Dezaktywuj' : '▶ Aktywuj'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={_handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Usuń
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{formatPLN(bill.amount)}</span>
          <span className="text-sm text-muted-foreground">
            {FREQUENCY_LABELS[bill.frequency]}
          </span>
        </div>

        {/* Category display */}
        {bill.categoryId && categories && (() => {
          const cat = categories.find((c) => c.id === bill.categoryId);
          return cat ? (
            <div className="flex items-center gap-1.5 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-muted-foreground">{cat.name}</span>
            </div>
          ) : null;
        })()}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Termin: {bill.dueDay} dzień miesiąca
            {!isPaid && (
              <span className={isOverdue ? ' font-medium text-red-500' : ''}>
                {' '}
                ({daysUntil < 0 ? `${Math.abs(daysUntil)} dni temu` : `za ${daysUntil} dni`})
              </span>
            )}
          </span>
        </div>

        {budgetExceeded && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Kwota przekracza limit {formatPLN(bill.budgetLimit!)} o{' '}
              {formatPLN(bill.amount - bill.budgetLimit!)}
            </span>
          </div>
        )}

        {bill.paymentStats && bill.paymentStats.paymentCount > 0 && (
          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Średnia: {formatPLN(bill.paymentStats.averageAmount)}</span>
              <span>{bill.paymentStats.paymentCount} płatności</span>
            </div>
            {bill.budgetLimit != null && (
              <Progress
                value={Math.min((bill.amount / bill.budgetLimit) * 100, 100)}
                className="mt-1.5 h-1.5"
              />
            )}
          </div>
        )}

        {bill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bill.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-xs"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {bill.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{bill.notes}</p>
        )}

        {isPartiallyPaid && bill.remainingAmount != null && (
          <div className="flex items-center gap-1.5 rounded-md bg-orange-50 p-2 text-xs text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Wpłacono {formatPLN(bill.paidAmount ?? 0)} z {formatPLN(bill.amount)} — brakuje{' '}
              {formatPLN(bill.remainingAmount)}
            </span>
          </div>
        )}

        {!isPaid && bill.isActive && (
          <Button size="sm" className="w-full" onClick={_handlePay}>
            <CreditCard className="mr-1.5 h-4 w-4" />
            {isPartiallyPaid ? `Dopłać ${formatPLN(bill.remainingAmount ?? 0)}` : 'Opłać'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
