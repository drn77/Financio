'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wallet, TrendingDown, CalendarClock, Loader2, ScanLine } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { toastError } from '@/lib/toast';

interface ISummary {
  balance: number;
  balanceAfterPlanned: number;
  incurredCosts: number;
  plannedCosts: number;
  pendingReceiptOcrCount: number;
  upcomingPlannedPayments: Array<{
    id: string;
    source: 'bill' | 'savings';
    name: string;
    amount: number;
    currency: string;
    dueDate: string;
  }>;
}

type IPlannedPayment = ISummary['upcomingPlannedPayments'][number];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  });
}

function sourceLabel(source: 'bill' | 'savings'): string {
  if (source === 'bill') return 'Rachunek';
  return 'Oszczędność';
}

function useSummary() {
  const [summary, setSummary] = useState<ISummary | null>(null);

  const refresh = useCallback(() => {
    api.getDashboardSummary()
      .then((data) => {
        const upcomingPlannedPayments = (data.upcomingPlannedPayments ?? []).filter(
          (
            payment,
          ): payment is {
            id: string;
            source: 'bill' | 'savings';
            name: string;
            amount: number;
            currency: string;
            dueDate: string;
          } => payment.source === 'bill' || payment.source === 'savings',
        );

        setSummary({
          ...data,
          upcomingPlannedPayments,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleSummaryRefresh = () => {
      refresh();
    };

    // Initial fetch via interval with 0 delay to avoid sync setState in effect
    const immediate = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 60_000);
    window.addEventListener('financio:summary-refresh', handleSummaryRefresh);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
      window.removeEventListener('financio:summary-refresh', handleSummaryRefresh);
    };
  }, [refresh]);

  return summary;
}

export function TopBar() {
  const router = useRouter();
  const summary = useSummary();
  const [selectedPayment, setSelectedPayment] = useState<IPlannedPayment | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [paying, setPaying] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [editData, setEditData] = useState<Record<string, any>>({});

  const refreshSummary = useCallback(() => {
    window.dispatchEvent(new Event('financio:summary-refresh'));
  }, []);

  const openPaymentDialog = async (payment: IPlannedPayment) => {
    setSelectedPayment(payment);
    setShowPaymentDialog(true);
    setPayAmount(String(Number(payment.amount || 0)));
    setPayNotes('');
    setLoadingDetails(true);

    try {
      if (payment.source === 'bill') {
        const bill = await api.getBill(payment.id);
        setEditData({
          name: bill.name,
          amount: Number(bill.amount ?? payment.amount ?? 0),
          dueDay: Number(bill.dueDay ?? 1),
          notes: bill.notes ?? '',
        });
      } else {
        const goals = await api.getSavingsGoals();
        const goal = (goals ?? []).find((g: any) => g.id === payment.id);
        setEditData({
          name: goal?.name ?? payment.name,
          targetAmount: Number(goal?.targetAmount ?? payment.amount ?? 0),
          deadline: goal?.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
        });
      }
    } catch (e) {
      console.error('Failed to load payment details', e);
      toastError('Nie udało się pobrać szczegółów płatności.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePay = async () => {
    if (!selectedPayment) return;
    const amount = Number(payAmount || 0);
    if (!amount || amount <= 0) {
      toastError('Podaj poprawną kwotę płatności.');
      return;
    }

    setPaying(true);
    try {
      if (selectedPayment.source === 'bill') {
        await api.payBill(selectedPayment.id, {
          amount,
          dueDate: selectedPayment.dueDate,
          notes: payNotes || undefined,
        });
      } else {
        await api.addDeposit(selectedPayment.id, {
          amount,
          date: new Date().toISOString(),
          notes: payNotes || undefined,
        });
      }

      setShowPaymentDialog(false);
      setSelectedPayment(null);
      refreshSummary();
    } catch (e) {
      console.error('Payment action failed', e);
    } finally {
      setPaying(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPayment) return;
    setSavingEdit(true);
    try {
      if (selectedPayment.source === 'bill') {
        await api.updateBill(selectedPayment.id, {
          name: editData.name,
          amount: Number(editData.amount || 0),
          dueDay: Number(editData.dueDay || 1),
          notes: editData.notes || undefined,
        });
      } else {
        await api.updateSavingsGoal(selectedPayment.id, {
          name: editData.name,
          targetAmount: Number(editData.targetAmount || 0),
          deadline: editData.deadline || undefined,
        });
      }

      refreshSummary();
    } catch (e) {
      console.error('Save edit failed', e);
    } finally {
      setSavingEdit(false);
    }
  };

  const gotoSource = () => {
    if (!selectedPayment) return;
    if (selectedPayment.source === 'bill') router.push('/bills');
    else router.push('/savings');
    setShowPaymentDialog(false);
  };

  if (!summary) {
    return (
      <div className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm animate-pulse" />
    );
  }

  return (
    <div className="sticky top-0 z-30 border-b border-border/50 bg-card/80 backdrop-blur-sm lg:top-0">
      {/* Mobile: scrollable horizontal row */}
      <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto no-scrollbar lg:gap-6 lg:px-6 lg:py-3">
        {summary.pendingReceiptOcrCount > 0 && (
          <button
            type="button"
            onClick={() => router.push('/receipts')}
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary shrink-0"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <ScanLine className="h-3.5 w-3.5" />
            Przetwarzanie paragonu… ({summary.pendingReceiptOcrCount})
          </button>
        )}

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

        {/* Divider */}
        <div className="h-8 w-px shrink-0 bg-border/60 hidden sm:block" />

        {/* Upcoming planned payments */}
        <div className="flex flex-col min-w-65 gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Najbliższe płatności</span>
          <div className="flex flex-wrap gap-1.5">
            {(summary.upcomingPlannedPayments ?? []).slice(0, 4).map((p) => (
              <button
                key={`${p.source}-${p.id}`}
                type="button"
                onClick={() => openPaymentDialog(p)}
                className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[10px] leading-tight text-left hover:bg-accent/70"
              >
                <div className="font-medium text-foreground truncate max-w-38">{p.name}</div>
                <div className="text-muted-foreground">{sourceLabel(p.source)} · {formatDate(p.dueDate)}</div>
                <div className="font-semibold text-foreground">{formatCurrency(Number(p.amount) || 0)}</div>
              </button>
            ))}
            {(!summary.upcomingPlannedPayments || summary.upcomingPlannedPayments.length === 0) && (
              <div className="text-[10px] text-muted-foreground">Brak zaplanowanych płatności</div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zarządzaj płatnością</DialogTitle>
            <DialogDescription>
              Opłać część lub całość, edytuj i przejdź do źródła.
            </DialogDescription>
          </DialogHeader>

          {!selectedPayment || loadingDetails ? (
            <div className="py-4 text-sm text-muted-foreground">Ładowanie...</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-semibold">{selectedPayment.name}</p>
                <p className="text-muted-foreground">{sourceLabel(selectedPayment.source)} · {formatDate(selectedPayment.dueDate)}</p>
                <p className="mt-1 font-semibold">Do zapłaty: {formatCurrency(Number(selectedPayment.amount) || 0)}</p>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Płatność</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Kwota</Label>
                    <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Szybki wybór</Label>
                    <div className="flex gap-2 pt-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setPayAmount(String(Number(selectedPayment.amount || 0) / 2))}>50%</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setPayAmount(String(Number(selectedPayment.amount || 0)))}>100%</Button>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Notatka</Label>
                  <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opcjonalnie" />
                </div>
                <Button className="w-full" onClick={handlePay} disabled={paying}>{paying ? 'Zapisywanie...' : 'Zatwierdź płatność'}</Button>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Szybka edycja</p>

                {selectedPayment.source === 'bill' && (
                  <>
                    <div><Label>Nazwa</Label><Input value={editData.name ?? ''} onChange={(e) => setEditData((p) => ({ ...(p ?? {}), name: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Kwota</Label><Input type="number" value={editData.amount ?? 0} onChange={(e) => setEditData((p) => ({ ...(p ?? {}), amount: Number(e.target.value || 0) }))} /></div>
                      <div><Label>Dzień terminu</Label><Input type="number" min={1} max={31} value={editData.dueDay ?? 1} onChange={(e) => setEditData((p) => ({ ...(p ?? {}), dueDay: Number(e.target.value || 1) }))} /></div>
                    </div>
                  </>
                )}

                {selectedPayment.source === 'savings' && (
                  <>
                    <div><Label>Nazwa celu</Label><Input value={editData.name ?? ''} onChange={(e) => setEditData((p) => ({ ...(p ?? {}), name: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Kwota celu</Label><Input type="number" value={editData.targetAmount ?? 0} onChange={(e) => setEditData((p) => ({ ...(p ?? {}), targetAmount: Number(e.target.value || 0) }))} /></div>
                      <div><Label>Termin</Label><Input type="date" value={editData.deadline ?? ''} onChange={(e) => setEditData((p) => ({ ...(p ?? {}), deadline: e.target.value }))} /></div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button variant="outline" onClick={gotoSource}>Przejdź do źródła</Button>
                  <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Zapisywanie...' : 'Zapisz edycję'}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
