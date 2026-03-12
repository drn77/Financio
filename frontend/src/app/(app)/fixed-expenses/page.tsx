'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Repeat, CreditCard } from 'lucide-react';
import { toastError } from '@/lib/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

const FREQ_MAP: Record<string, string> = {
  DAILY: 'Codziennie',
  WEEKLY: 'Tygodniowo',
  MONTHLY: 'Miesięcznie',
  QUARTERLY: 'Kwartalnie',
  YEARLY: 'Rocznie',
};

export default function FixedExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tagGroups, setTagGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', amount: '', frequency: 'MONTHLY', dayOfMonth: '',
    startDate: new Date().toISOString().split('T')[0],
    nextDueDate: new Date().toISOString().split('T')[0],
    notes: '',
    paymentTagId: '__none__',
    paymentTemplateData: '{"col_paid": true}',
  });

  const loadExpenses = useCallback(async () => {
    try {
      const [data, groups] = await Promise.all([
        api.getFixedExpenses(),
        api.getTagGroups().catch(() => []),
      ]);
      setExpenses(Array.isArray(data) ? data : []);
      setTagGroups(Array.isArray(groups) ? groups : []);
    } catch { setExpenses([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleAdd = async () => {
    if (!form.name || !form.amount) return;

    let parsedTemplateData: Record<string, unknown> | undefined;
    if (form.paymentTemplateData.trim()) {
      try {
        parsedTemplateData = JSON.parse(form.paymentTemplateData);
      } catch {
        toastError('Niepoprawny JSON w polu "Dane rekordu"');
        return;
      }
    }

    try {
      await api.createFixedExpense({
        name: form.name,
        amount: Number(form.amount),
        frequency: form.frequency,
        dayOfMonth: form.dayOfMonth ? Number(form.dayOfMonth) : undefined,
        startDate: form.startDate,
        nextDueDate: form.nextDueDate || undefined,
        notes: form.notes || undefined,
        paymentTagId: form.paymentTagId !== '__none__' ? form.paymentTagId : undefined,
        paymentTemplateData: parsedTemplateData,
      });
      setForm({
        name: '',
        amount: '',
        frequency: 'MONTHLY',
        dayOfMonth: '',
        startDate: new Date().toISOString().split('T')[0],
        nextDueDate: new Date().toISOString().split('T')[0],
        notes: '',
        paymentTagId: '__none__',
        paymentTemplateData: '{"col_paid": true}',
      });
      setShowAdd(false);
      loadExpenses();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    try { await api.deleteFixedExpense(id); loadExpenses(); } catch (e) { console.error(e); }
  };

  const handleOpenEdit = (expense: any) => {
    setEditingExpense({
      id: expense.id,
      name: expense.name ?? '',
      amount: String(Number(expense.amount ?? 0)),
      frequency: expense.frequency ?? 'MONTHLY',
      dayOfMonth: expense.dayOfMonth ? String(expense.dayOfMonth) : '',
      startDate: expense.startDate ? new Date(expense.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      nextDueDate: expense.nextDueDate ? new Date(expense.nextDueDate).toISOString().split('T')[0] : '',
      notes: expense.notes ?? '',
      paymentTagId: expense.paymentTagId ?? '__none__',
      paymentTemplateData: expense.paymentTemplateData ? JSON.stringify(expense.paymentTemplateData, null, 2) : '{"col_paid": true}',
      isActive: expense.isActive !== false,
    });
  };

  const handleUpdate = async () => {
    if (!editingExpense?.id) return;

    let parsedTemplateData: Record<string, unknown> | undefined;
    if ((editingExpense.paymentTemplateData ?? '').trim()) {
      try {
        parsedTemplateData = JSON.parse(editingExpense.paymentTemplateData);
      } catch {
        toastError('Niepoprawny JSON w polu "Dane rekordu"');
        return;
      }
    }

    setSavingEdit(true);
    try {
      await api.updateFixedExpense(editingExpense.id, {
        name: editingExpense.name,
        amount: Number(editingExpense.amount),
        frequency: editingExpense.frequency,
        dayOfMonth: editingExpense.dayOfMonth ? Number(editingExpense.dayOfMonth) : undefined,
        startDate: editingExpense.startDate,
        nextDueDate: editingExpense.nextDueDate || undefined,
        notes: editingExpense.notes || undefined,
        paymentTagId: editingExpense.paymentTagId !== '__none__' ? editingExpense.paymentTagId : undefined,
        paymentTemplateData: parsedTemplateData,
        isActive: !!editingExpense.isActive,
      });
      setEditingExpense(null);
      await loadExpenses();
      window.dispatchEvent(new Event('financio:summary-refresh'));
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePay = async (expense: any) => {
    setPayingId(expense.id);
    try {
      await api.payFixedExpense(expense.id, {});
      window.dispatchEvent(new Event('financio:summary-refresh'));
      await loadExpenses();
    } catch (e) {
      console.error(e);
    } finally {
      setPayingId(null);
    }
  };

  const allTags = tagGroups.flatMap((g: any) => (g.tags ?? []).map((t: any) => ({ ...t, groupName: g.name })));

  const monthlyTotal = expenses.reduce((s, e) => {
    const a = Number(e.amount ?? 0);
    if (e.frequency === 'YEARLY') return s + a / 12;
    if (e.frequency === 'QUARTERLY') return s + a / 3;
    if (e.frequency === 'WEEKLY') return s + a * 4.33;
    if (e.frequency === 'DAILY') return s + a * 30;
    return s + a;
  }, 0);

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stałe wydatki</h1>
          <p className="text-sm text-muted-foreground">
            Miesięcznie ok. {formatPLN(monthlyTotal)}
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Dodaj</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle><Repeat className="h-5 w-5 inline mr-2" />Nowy stały wydatek</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nazwa</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="np. Netflix" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kwota (PLN)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></div>
                <div>
                  <Label>Częstotliwość</Label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({...form, frequency: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dzień miesiąca</Label><Input type="number" min="1" max="31" value={form.dayOfMonth} onChange={(e) => setForm({...form, dayOfMonth: e.target.value})} /></div>
                <div><Label>Data początku</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Najbliższa płatność</Label><Input type="date" value={form.nextDueDate} onChange={(e) => setForm({...form, nextDueDate: e.target.value})} /></div>
                <div>
                  <Label>Tag płatności</Label>
                  <Select value={form.paymentTagId} onValueChange={(v) => setForm({ ...form, paymentTagId: v })}>
                    <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Brak</SelectItem>
                      {allTags.map((tag: any) => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name} ({tag.groupName})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notatki</Label><Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
              <div>
                <Label>Dane rekordu (JSON)</Label>
                <Textarea
                  rows={4}
                  value={form.paymentTemplateData}
                  onChange={(e) => setForm({ ...form, paymentTemplateData: e.target.value })}
                  placeholder='{"col_person":"Jan","col_paid":true}'
                />
              </div>
              <Button className="w-full" onClick={handleAdd}>Dodaj</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {expenses.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Brak stałych wydatków</p>
        ) : expenses.map((exp) => (
          <Card key={exp.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{exp.name}</CardTitle>
              <Badge variant="outline">{FREQ_MAP[exp.frequency] ?? exp.frequency}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPLN(Number(exp.amount))}</p>
              {exp.dayOfMonth && <p className="text-sm text-muted-foreground mt-1">{exp.dayOfMonth} dzień miesiąca</p>}
              {exp.nextDueDate && <p className="text-sm text-muted-foreground mt-1">Najbliższa płatność: {new Date(exp.nextDueDate).toLocaleDateString('pl-PL')}</p>}
              {exp.notes && <p className="text-xs text-muted-foreground mt-1">{exp.notes}</p>}
              <Button size="sm" className="mt-3 mr-2" onClick={() => handlePay(exp)} disabled={payingId === exp.id}>
                <CreditCard className="h-4 w-4 mr-1" />
                {payingId === exp.id ? 'Płacenie...' : 'Zapłać'}
              </Button>
              <Button size="sm" variant="outline" className="mt-3 mr-2" onClick={() => handleOpenEdit(exp)}>
                Edytuj
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive mt-2" onClick={() => handleDelete(exp.id)}>
                <Trash2 className="h-4 w-4 mr-1" /> Usuń
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingExpense} onOpenChange={(open) => { if (!open) setEditingExpense(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edytuj stały wydatek</DialogTitle></DialogHeader>
          {editingExpense && (
            <div className="space-y-3">
              <div><Label>Nazwa</Label><Input value={editingExpense.name} onChange={(e) => setEditingExpense({ ...editingExpense, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kwota (PLN)</Label><Input type="number" step="0.01" value={editingExpense.amount} onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })} /></div>
                <div>
                  <Label>Częstotliwość</Label>
                  <Select value={editingExpense.frequency} onValueChange={(v) => setEditingExpense({ ...editingExpense, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dzień miesiąca</Label><Input type="number" min="1" max="31" value={editingExpense.dayOfMonth} onChange={(e) => setEditingExpense({ ...editingExpense, dayOfMonth: e.target.value })} /></div>
                <div><Label>Data początku</Label><Input type="date" value={editingExpense.startDate} onChange={(e) => setEditingExpense({ ...editingExpense, startDate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Najbliższa płatność</Label><Input type="date" value={editingExpense.nextDueDate} onChange={(e) => setEditingExpense({ ...editingExpense, nextDueDate: e.target.value })} /></div>
                <div>
                  <Label>Tag płatności</Label>
                  <Select value={editingExpense.paymentTagId} onValueChange={(v) => setEditingExpense({ ...editingExpense, paymentTagId: v })}>
                    <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Brak</SelectItem>
                      {allTags.map((tag: any) => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name} ({tag.groupName})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notatki</Label><Input value={editingExpense.notes} onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })} /></div>
              <div>
                <Label>Dane rekordu (JSON)</Label>
                <Textarea
                  rows={4}
                  value={editingExpense.paymentTemplateData}
                  onChange={(e) => setEditingExpense({ ...editingExpense, paymentTemplateData: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleUpdate} disabled={savingEdit}>{savingEdit ? 'Zapisywanie...' : 'Zapisz zmiany'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
