'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, PiggyBank, TrendingUp } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', deadline: '' });
  const [depositFor, setDepositFor] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  const loadGoals = useCallback(async () => {
    try {
      const data = await api.getSavingsGoals();
      setGoals(Array.isArray(data) ? data : []);
    } catch { setGoals([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const handleAddGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount) return;
    try {
      await api.createSavingsGoal({
        name: goalForm.name,
        targetAmount: Number(goalForm.targetAmount),
        deadline: goalForm.deadline || undefined,
      });
      setGoalForm({ name: '', targetAmount: '', deadline: '' });
      setShowAddGoal(false);
      loadGoals();
    } catch (e) { console.error(e); }
  };

  const handleDeposit = async () => {
    if (!depositFor || !depositAmount) return;
    try {
      await api.addDeposit(depositFor, {
        amount: Number(depositAmount),
        date: new Date().toISOString(),
      });
      setDepositFor(null);
      setDepositAmount('');
      loadGoals();
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oszczędności</h1>
          <p className="text-sm text-muted-foreground">Cele oszczędnościowe</p>
        </div>
        <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nowy cel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle><PiggyBank className="h-5 w-5 inline mr-2" />Nowy cel oszczędnościowy</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nazwa</Label><Input value={goalForm.name} onChange={(e) => setGoalForm({...goalForm, name: e.target.value})} placeholder="np. Wakacje" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cel (PLN)</Label><Input type="number" step="0.01" value={goalForm.targetAmount} onChange={(e) => setGoalForm({...goalForm, targetAmount: e.target.value})} /></div>
                <div><Label>Termin</Label><Input type="date" value={goalForm.deadline} onChange={(e) => setGoalForm({...goalForm, deadline: e.target.value})} /></div>
              </div>
              <Button className="w-full" onClick={handleAddGoal}>Utwórz cel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Brak celów oszczędnościowych</p>
        ) : goals.map((goal) => {
          const current = Number(goal.currentAmount ?? 0);
          const target = Number(goal.targetAmount ?? 1);
          const progress = Math.min((current / target) * 100, 100);
          return (
            <Card key={goal.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PiggyBank className="h-5 w-5 text-primary" /> {goal.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{formatPLN(current)}</span>
                    <span className="font-medium">{formatPLN(target)}</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(1)}% ukończone</p>
                </div>
                {goal.deadline && (
                  <p className="text-xs text-muted-foreground">
                    Termin: {new Date(goal.deadline).toLocaleDateString('pl-PL')}
                  </p>
                )}
                <Dialog open={depositFor === goal.id} onOpenChange={(open) => { if (!open) setDepositFor(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setDepositFor(goal.id)}>
                      <TrendingUp className="h-4 w-4 mr-1" /> Wpłać
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Wpłata do &quot;{goal.name}&quot;</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Kwota (PLN)</Label><Input type="number" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} /></div>
                      <Button className="w-full" onClick={handleDeposit}>Wpłać</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
