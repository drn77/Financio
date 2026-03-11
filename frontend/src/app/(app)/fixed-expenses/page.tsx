'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Trash2, Repeat } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', amount: '', frequency: 'MONTHLY', dayOfMonth: '',
    startDate: new Date().toISOString().split('T')[0], notes: '',
  });

  const loadExpenses = useCallback(async () => {
    try {
      const data = await api.getFixedExpenses();
      setExpenses(Array.isArray(data) ? data : []);
    } catch { setExpenses([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleAdd = async () => {
    if (!form.name || !form.amount) return;
    try {
      await api.createFixedExpense({
        name: form.name,
        amount: Number(form.amount),
        frequency: form.frequency,
        dayOfMonth: form.dayOfMonth ? Number(form.dayOfMonth) : undefined,
        startDate: form.startDate,
        notes: form.notes || undefined,
      });
      setForm({ name: '', amount: '', frequency: 'MONTHLY', dayOfMonth: '', startDate: new Date().toISOString().split('T')[0], notes: '' });
      setShowAdd(false);
      loadExpenses();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    try { await api.deleteFixedExpense(id); loadExpenses(); } catch (e) { console.error(e); }
  };

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
              <div><Label>Notatki</Label><Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
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
              {exp.notes && <p className="text-xs text-muted-foreground mt-1">{exp.notes}</p>}
              <Button size="sm" variant="ghost" className="text-destructive mt-2" onClick={() => handleDelete(exp.id)}>
                <Trash2 className="h-4 w-4 mr-1" /> Usuń
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
