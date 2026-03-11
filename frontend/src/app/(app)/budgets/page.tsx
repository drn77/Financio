'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Edit2, MoreHorizontal, PiggyBank, Target } from 'lucide-react';
import type { IBudget, IBudgetCategory } from '@shared/models';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

const MONTH_NAMES = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

interface Category { id: string; name: string; color: string | null; icon: string | null; }

// ─── Budget Form ────────────────────────────────────
function BudgetFormDialog({ open, onOpenChange, budget, categories, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  budget?: IBudget | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const now = new Date();
  const [name, setName] = useState('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [budgetCategories, setBudgetCategories] = useState<{ categoryId: string; limitAmount: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (budget) {
        setName(budget.name);
        setMonth(String(budget.month));
        setYear(String(budget.year));
        setBudgetCategories(budget.categories?.map(c => ({
          categoryId: c.categoryId,
          limitAmount: String(c.limitAmount),
        })) ?? []);
      } else {
        setName(`Budżet ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`);
        setMonth(String(now.getMonth() + 1));
        setYear(String(now.getFullYear()));
        setBudgetCategories([]);
      }
    }
  }, [open, budget]);

  const addCategory = () => setBudgetCategories([...budgetCategories, { categoryId: '', limitAmount: '' }]);

  const updateCategory = (idx: number, field: string, value: string) => {
    const updated = [...budgetCategories];
    (updated[idx] as any)[field] = value;
    setBudgetCategories(updated);
  };

  const removeCategory = (idx: number) => setBudgetCategories(budgetCategories.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        month: parseInt(month),
        year: parseInt(year),
        categories: budgetCategories
          .filter(c => c.categoryId && c.limitAmount)
          .map(c => ({ categoryId: c.categoryId, limitAmount: Number(c.limitAmount) })),
      };
      if (budget) {
        await api.updateBudget(budget.id, data);
      } else {
        await api.createBudget(data);
      }
      onOpenChange(false);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const usedCategoryIds = new Set(budgetCategories.map(c => c.categoryId));
  const totalLimit = budgetCategories.reduce((sum, c) => sum + (Number(c.limitAmount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{budget ? 'Edytuj budżet' : 'Nowy budżet'}</DialogTitle>
          <DialogDescription>Ustaw limity wydatków na dany miesiąc</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nazwa</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Miesiąc</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rok</Label>
              <Input type="number" min="2020" value={year} onChange={e => setYear(e.target.value)} />
            </div>
          </div>

          {/* Category limits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Limity kategorii</Label>
              <Button variant="outline" size="sm" onClick={addCategory}><Plus className="h-3 w-3 mr-1" /> Kategoria</Button>
            </div>
            {budgetCategories.map((bc, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end mb-2">
                <div className="col-span-7">
                  {idx === 0 && <Label className="text-xs">Kategoria</Label>}
                  <Select value={bc.categoryId} onValueChange={v => updateCategory(idx, 'categoryId', v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => c.id === bc.categoryId || !usedCategoryIds.has(c.id)).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  {idx === 0 && <Label className="text-xs">Limit (PLN)</Label>}
                  <Input type="number" step="0.01" value={bc.limitAmount} onChange={e => updateCategory(idx, 'limitAmount', e.target.value)} className="h-8" placeholder="0.00" />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCategory(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {budgetCategories.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">Łączny limit: {formatPLN(totalLimit)}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Zapisywanie...' : (budget ? 'Zapisz' : 'Utwórz')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Budget Card ────────────────────────────────────
function BudgetCard({ budget, onEdit, onDelete }: {
  budget: IBudget;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overallProgress = (budget.totalLimit ?? 0) > 0
    ? Math.min(100, Math.round(((budget.totalSpent ?? 0) / (budget.totalLimit ?? 1)) * 100))
    : 0;

  const isOverBudget = (budget.totalSpent ?? 0) > (budget.totalLimit ?? 0);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{budget.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {MONTH_NAMES[(budget.month ?? 1) - 1]} {budget.year}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Edit2 className="h-3 w-3 mr-2" /> Edytuj</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Usuń</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overall progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className={isOverBudget ? 'text-destructive font-semibold' : ''}>
              {formatPLN(budget.totalSpent ?? 0)}
            </span>
            <span className="text-muted-foreground">/ {formatPLN(budget.totalLimit ?? 0)}</span>
          </div>
          <Progress value={overallProgress} className={isOverBudget ? '[&>div]:bg-destructive' : ''} />
        </div>

        {/* Category breakdown */}
        {budget.categories && budget.categories.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {budget.categories.map((cat: IBudgetCategory) => {
              const catProgress = Math.min(100, cat.progress ?? 0);
              const catOver = (cat.spentAmount ?? 0) > cat.limitAmount;
              return (
                <div key={cat.id}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.categoryColor ?? '#666' }} />
                      {cat.categoryName}
                    </span>
                    <span className={catOver ? 'text-destructive' : 'text-muted-foreground'}>
                      {formatPLN(cat.spentAmount ?? 0)} / {formatPLN(cat.limitAmount)}
                    </span>
                  </div>
                  <Progress value={catProgress} className={`h-1.5 ${catOver ? '[&>div]:bg-destructive' : ''}`} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────
export default function BudgetsPage() {
  const now = new Date();
  const [budgets, setBudgets] = useState<IBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<IBudget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));

  const loadData = useCallback(async () => {
    try {
      const [budgetsData, categoriesData] = await Promise.all([
        api.getBudgets(parseInt(yearFilter)),
        api.getCategories(),
      ]);
      setBudgets(Array.isArray(budgetsData) ? budgetsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData as Category[] : []);
    } catch { setBudgets([]); }
    finally { setLoading(false); }
  }, [yearFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.deleteBudget(deleteId); setDeleteId(null); loadData(); } catch (e) { console.error(e); }
  };

  const currentBudget = budgets.find(b => b.month === now.getMonth() + 1 && b.year === now.getFullYear());

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" /> Budżety
          </h1>
          <p className="text-sm text-muted-foreground">
            Kontroluj limity wydatków w poszczególnych kategoriach
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditBudget(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nowy budżet
          </Button>
        </div>
      </div>

      {/* Current month highlight */}
      {currentBudget && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PiggyBank className="h-5 w-5" /> Bieżący miesiąc: {MONTH_NAMES[now.getMonth()]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-bold">{formatPLN(currentBudget.totalSpent ?? 0)}</span>
              <span className="text-muted-foreground">z {formatPLN(currentBudget.totalLimit ?? 0)}</span>
            </div>
            <Progress
              value={(currentBudget.totalLimit ?? 0) > 0
                ? Math.min(100, Math.round(((currentBudget.totalSpent ?? 0) / (currentBudget.totalLimit ?? 1)) * 100))
                : 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pozostało: {formatPLN(Math.max(0, (currentBudget.totalLimit ?? 0) - (currentBudget.totalSpent ?? 0)))}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Budget cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-8 text-muted-foreground">
              Brak budżetów na {yearFilter}. Utwórz pierwszy budżet!
            </CardContent>
          </Card>
        ) : budgets.map(b => (
          <BudgetCard
            key={b.id}
            budget={b}
            onEdit={() => { setEditBudget(b); setShowForm(true); }}
            onDelete={() => setDeleteId(b.id)}
          />
        ))}
      </div>

      {/* Form Dialog */}
      <BudgetFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditBudget(null); }}
        budget={editBudget}
        categories={categories}
        onSaved={loadData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć budżet?</AlertDialogTitle>
            <AlertDialogDescription>Budżet zostanie trwale usunięty. Paragony i wydatki nie zostaną zmienione.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
