'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, PiggyBank, TrendingUp, Settings, Trash2, Pencil } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

interface TagOption {
  id: string;
  name: string;
  color: string;
  groupName: string;
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    deadline: '',
    autoCreateExpense: false,
    paymentTagId: '',
  });
  const [depositFor, setDepositFor] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const [settingsGoal, setSettingsGoal] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    autoCreateExpense: false,
    paymentTagId: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [goalsData, tagGroupsData] = await Promise.all([
        api.getSavingsGoals(),
        api.getTagGroups(),
      ]);
      setGoals(Array.isArray(goalsData) ? goalsData : []);

      const flatTags: TagOption[] = [];
      if (Array.isArray(tagGroupsData)) {
        for (const group of tagGroupsData) {
          if (Array.isArray(group.tags)) {
            for (const tag of group.tags) {
              flatTags.push({
                id: tag.id,
                name: tag.name,
                color: tag.color || '#2ECC71',
                groupName: group.name,
              });
            }
          }
        }
      }
      setTags(flatTags);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount) return;
    try {
      await api.createSavingsGoal({
        name: goalForm.name,
        targetAmount: Number(goalForm.targetAmount),
        deadline: goalForm.deadline || undefined,
        autoCreateExpense: goalForm.autoCreateExpense,
        paymentTagId: goalForm.paymentTagId || undefined,
      });
      setGoalForm({ name: '', targetAmount: '', deadline: '', autoCreateExpense: false, paymentTagId: '' });
      setShowAddGoal(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleEditGoal = async () => {
    if (!editingGoal || !goalForm.name || !goalForm.targetAmount) return;
    try {
      await api.updateSavingsGoal(editingGoal.id, {
        name: goalForm.name,
        targetAmount: Number(goalForm.targetAmount),
        deadline: goalForm.deadline || undefined,
      });
      setShowEditGoal(false);
      setEditingGoal(null);
      setGoalForm({ name: '', targetAmount: '', deadline: '', autoCreateExpense: false, paymentTagId: '' });
      loadData();
    } catch (e) { console.error(e); }
  };

  const openEditGoal = (goal: any) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
      autoCreateExpense: false,
      paymentTagId: '',
    });
    setShowEditGoal(true);
  };

  const handleDeleteGoal = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSavingsGoal(deleteTarget.id);
      loadData();
    } catch (e) { console.error(e); }
    finally { setDeleteTarget(null); }
  };

  const openSettings = (goal: any) => {
    setSettingsGoal(goal);
    setSettingsForm({
      autoCreateExpense: goal.autoCreateExpense ?? false,
      paymentTagId: goal.paymentTagId ?? '',
    });
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsGoal) return;
    try {
      await api.updateSavingsGoal(settingsGoal.id, {
        autoCreateExpense: settingsForm.autoCreateExpense,
        paymentTagId: settingsForm.paymentTagId || null,
      });
      setShowSettings(false);
      setSettingsGoal(null);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeposit = async () => {
    if (!depositFor || !depositAmount) return;
    try {
      await api.addDeposit(depositFor, {
        amount: Number(depositAmount),
        date: new Date().toISOString(),
        notes: depositNotes || undefined,
      });
      setDepositFor(null);
      setDepositAmount('');
      setDepositNotes('');
      loadData();
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-goal-auto-expense"
                  checked={goalForm.autoCreateExpense}
                  onCheckedChange={(checked) => setGoalForm({ ...goalForm, autoCreateExpense: checked === true })}
                />
                <Label htmlFor="new-goal-auto-expense" className="cursor-pointer text-sm font-normal">
                  Automatycznie twórz wydatek przy wpłacie
                </Label>
              </div>
              {goalForm.autoCreateExpense && tags.length > 0 && (
                <div>
                  <Label>Tag wydatku</Label>
                  <Select
                    value={goalForm.paymentTagId || '__none'}
                    onValueChange={(v) => setGoalForm({ ...goalForm, paymentTagId: v === '__none' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Brak</SelectItem>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PiggyBank className="h-5 w-5 text-primary" /> {goal.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSettings(goal)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGoal(goal)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(goal)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
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
                {goal.autoCreateExpense && (
                  <p className="text-xs text-muted-foreground">
                    Auto-wydatek przy wpłacie
                  </p>
                )}
                <Dialog open={depositFor === goal.id} onOpenChange={(open) => { if (!open) { setDepositFor(null); setDepositNotes(''); } }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setDepositFor(goal.id)}>
                      <TrendingUp className="h-4 w-4 mr-1" /> Wpłać
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Wpłata do &quot;{goal.name}&quot;</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Kwota (PLN)</Label><Input type="number" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} /></div>
                      <div><Label>Notatka</Label><Input value={depositNotes} onChange={(e) => setDepositNotes(e.target.value)} placeholder="Opcjonalnie" /></div>
                      <Button className="w-full" onClick={handleDeposit}>Wpłać</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit goal dialog */}
      <Dialog open={showEditGoal} onOpenChange={(open) => { if (!open) { setShowEditGoal(false); setEditingGoal(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edytuj cel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa</Label><Input value={goalForm.name} onChange={(e) => setGoalForm({...goalForm, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cel (PLN)</Label><Input type="number" step="0.01" value={goalForm.targetAmount} onChange={(e) => setGoalForm({...goalForm, targetAmount: e.target.value})} /></div>
              <div><Label>Termin</Label><Input type="date" value={goalForm.deadline} onChange={(e) => setGoalForm({...goalForm, deadline: e.target.value})} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditGoal(false); setEditingGoal(null); }}>Anuluj</Button>
              <Button onClick={handleEditGoal}>Zapisz</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={showSettings} onOpenChange={(open) => { if (!open) { setShowSettings(false); setSettingsGoal(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle><Settings className="h-5 w-5 inline mr-2" />Ustawienia: {settingsGoal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="settings-auto-expense"
                checked={settingsForm.autoCreateExpense}
                onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, autoCreateExpense: checked === true })}
              />
              <Label htmlFor="settings-auto-expense" className="cursor-pointer text-sm font-normal">
                Automatycznie twórz wydatek na liście Wydatki przy wpłacie
              </Label>
            </div>
            {settingsForm.autoCreateExpense && tags.length > 0 && (
              <div>
                <Label>Tag stosowany do automatycznego wydatku</Label>
                <Select
                  value={settingsForm.paymentTagId || '__none'}
                  onValueChange={(v) => setSettingsForm({ ...settingsForm, paymentTagId: v === '__none' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Brak</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowSettings(false); setSettingsGoal(null); }}>Anuluj</Button>
              <Button onClick={handleSaveSettings}>Zapisz ustawienia</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć cel &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja jest nieodwracalna. Wszystkie wpłaty do tego celu zostaną usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGoal}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
