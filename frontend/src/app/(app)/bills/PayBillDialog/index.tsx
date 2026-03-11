'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard } from 'lucide-react';
import type { IBill } from '@shared/models';
import { formatPLN } from '../utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: IBill | null;
  onSubmit: (billId: string, amount: number, dueDate: string, notes?: string) => void;
  isSubmitting: boolean;
}

export function PayBillDialog({ open, onOpenChange, bill, onSubmit, isSubmitting }: Props) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const _handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen && bill) {
        const prefillAmount = bill.remainingAmount != null && bill.remainingAmount > 0
          ? bill.remainingAmount
          : bill.amount;
        setAmount(String(prefillAmount));
        setNotes('');
      }

      onOpenChange(isOpen);
    },
    [bill, onOpenChange],
  );

  const _handleSubmit = useCallback(() => {
    if (!bill || !amount) return;

    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.dueDay).toISOString();

    onSubmit(bill.id, Number(amount), dueDate, notes || undefined);
  }, [bill, amount, notes, onSubmit]);

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={_handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Opłać rachunek — {bill.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Oczekiwana kwota</span>
            <p className="text-lg font-semibold">{formatPLN(bill.amount)}</p>
            {bill.paidAmount != null && bill.paidAmount > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                Wpłacono już {formatPLN(bill.paidAmount)} — pozostało{' '}
                <span className="font-medium text-foreground">
                  {formatPLN(bill.remainingAmount ?? bill.amount)}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="pay-amount">Kwota płatności (PLN)</Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="pay-notes">Notatki (opcjonalnie)</Label>
            <Textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. Numer transakcji, uwagi..."
              className="min-h-16 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => _handleOpen(false)}>
            Anuluj
          </Button>
          <Button onClick={_handleSubmit} disabled={isSubmitting || !amount}>
            {isSubmitting ? 'Przetwarzanie...' : 'Potwierdź płatność'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
