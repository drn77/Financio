'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Edit2, MoreHorizontal, CalendarDays, MapPin, ArrowLeft,
  ShoppingCart, ListTodo, StickyNote, Receipt, Copy, Search, ChevronDown,
  Clock, CheckCircle2, XCircle, AlertCircle, CircleDot,
} from 'lucide-react';
import type {
  IEvent, IEventItem, IEventTodo, IEventNote, IEventExpense, IEventStats,
  EventStatus, EventItemStatus, TodoPriority,
} from '@shared/models';

// ─── Helpers ──────────────────────────────────────────

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; icon: React.ElementType }> = {
  PLANNED: { label: 'Zaplanowane', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Clock },
  ACTIVE: { label: 'W trakcie', color: 'bg-green-500/10 text-green-600 border-green-200', icon: CircleDot },
  COMPLETED: { label: 'Zakończone', color: 'bg-gray-500/10 text-gray-600 border-gray-200', icon: CheckCircle2 },
  CANCELLED: { label: 'Anulowane', color: 'bg-red-500/10 text-red-600 border-red-200', icon: XCircle },
};

const ITEM_STATUS: Record<EventItemStatus, { label: string; color: string }> = {
  PENDING: { label: 'Do kupienia', color: 'bg-yellow-100 text-yellow-700' },
  BOUGHT: { label: 'Kupione', color: 'bg-green-100 text-green-700' },
  SKIPPED: { label: 'Pominięte', color: 'bg-gray-100 text-gray-500' },
};

const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string }> = {
  LOW: { label: 'Niski', color: 'bg-blue-100 text-blue-700' },
  MEDIUM: { label: 'Średni', color: 'bg-yellow-100 text-yellow-700' },
  HIGH: { label: 'Wysoki', color: 'bg-red-100 text-red-700' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatCurrency(amount: number, currency = 'PLN') {
  return `${amount.toFixed(2)} ${currency}`;
}

// ─── Event Form Dialog ────────────────────────────────
interface Category { id: string; name: string; color: string | null; icon: string | null }
interface Member { id: string; nickname: string | null; username: string; userId: string }

function EventFormDialog({ open, onOpenChange, event, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: IEvent | null;
  onSave: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<string>('PLANNED');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (event) {
        setName(event.name);
        setDescription(event.description ?? '');
        setStartDate(event.startDate?.substring(0, 10) ?? '');
        setEndDate(event.endDate?.substring(0, 10) ?? '');
        setBudgetLimit(event.budgetLimit ? String(event.budgetLimit) : '');
        setColor(event.color);
        setIcon(event.icon ?? '');
        setLocation(event.location ?? '');
        setStatus(event.status);
      } else {
        setName(''); setDescription(''); setStartDate(new Date().toISOString().substring(0, 10));
        setEndDate(''); setBudgetLimit(''); setColor('#3B82F6'); setIcon('');
        setLocation(''); setStatus('PLANNED');
      }
    }
  }, [open, event]);

  const handleSubmit = async () => {
    if (!name.trim() || !startDate) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate: endDate || undefined,
        budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined,
        color,
        icon: icon || undefined,
        location: location.trim() || undefined,
        status,
      };
      if (event) {
        await api.updateEvent(event.id, data);
      } else {
        await api.createEvent(data);
      }
      onSave();
      onOpenChange(false);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Błąd'); }
    finally { setSaving(false); }
  };

  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</DialogTitle>
          <DialogDescription>{event ? 'Zmień szczegóły wydarzenia' : 'Zaplanuj nowe wydarzenie'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nazwa *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Urodziny Kasi" />
          </div>
          <div>
            <Label>Opis</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opis wydarzenia..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data rozpoczęcia *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Data zakończenia</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Budżet (PLN)</Label>
              <Input type="number" step="0.01" min="0" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [EventStatus, typeof STATUS_CONFIG[EventStatus]][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Lokalizacja</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. Restauracja Pod Lwem" />
          </div>
          <div>
            <Label>Ikona (emoji)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎂" className="w-24" />
          </div>
          <div>
            <Label>Kolor</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !startDate}>
            {saving ? 'Zapisuję...' : event ? 'Zapisz' : 'Utwórz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Event Card (list view) ──────────────────────────
function EventCard({ event, onClick, onEdit, onDuplicate, onDelete }: {
  event: IEvent;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[event.status];
  const StatusIcon = cfg.icon;
  const budgetProgress = event.budgetLimit && event.budgetLimit > 0
    ? Math.min(100, ((event.totalExpenses ?? 0) / event.budgetLimit) * 100)
    : null;
  const isOverBudget = budgetProgress !== null && budgetProgress >= 100;

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {event.icon && <span className="text-xl flex-shrink-0">{event.icon}</span>}
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{event.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{formatDate(event.startDate)}</span>
                {event.endDate && <span>– {formatDate(event.endDate)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge variant="outline" className={cfg.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {cfg.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}><Edit2 className="h-4 w-4 mr-2" />Edytuj</DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplikuj</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Usuń</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{event.description}</p>
        )}

        {event.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
          <div className="bg-muted/50 rounded px-2 py-1">
            <div className="font-medium">{event.itemsBought ?? 0}/{event.itemsTotal ?? 0}</div>
            <div className="text-muted-foreground">Zakupy</div>
          </div>
          <div className="bg-muted/50 rounded px-2 py-1">
            <div className="font-medium">{event.todosCompleted ?? 0}/{event.todosTotal ?? 0}</div>
            <div className="text-muted-foreground">Zadania</div>
          </div>
          <div className="bg-muted/50 rounded px-2 py-1">
            <div className="font-medium">{event.notes?.length ?? 0}</div>
            <div className="text-muted-foreground">Notatki</div>
          </div>
          <div className="bg-muted/50 rounded px-2 py-1">
            <div className="font-medium">{event.expenses?.length ?? 0}</div>
            <div className="text-muted-foreground">Wydatki</div>
          </div>
        </div>

        {budgetProgress !== null && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className={isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                {formatCurrency(event.totalExpenses ?? 0)} / {formatCurrency(event.budgetLimit!)}
              </span>
              <span className={isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                {Math.round(budgetProgress)}%
              </span>
            </div>
            <Progress value={budgetProgress} className={`h-1.5 ${isOverBudget ? '[&>div]:bg-destructive' : ''}`} />
          </div>
        )}

        {event.daysUntil !== null && event.daysUntil !== undefined && (event.status === 'PLANNED' || event.status === 'ACTIVE') && (
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {event.daysUntil === 0 ? 'Dzisiaj!' : event.daysUntil === 1 ? 'Jutro' : `Za ${event.daysUntil} dni`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shopping List Tab ────────────────────────────────
function ShoppingListTab({ event, categories, members, onReload }: {
  event: IEvent; categories: Category[]; members: Member[]; onReload: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newEstimated, setNewEstimated] = useState('');
  const [newAssigned, setNewAssigned] = useState('');
  const [editingItem, setEditingItem] = useState<IEventItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editEstimated, setEditEstimated] = useState('');
  const [editActual, setEditActual] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAssigned, setEditAssigned] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDialog, setEditDialog] = useState(false);

  const addItem = async () => {
    if (!newName.trim()) return;
    try {
      await api.addEventItem(event.id, {
        name: newName.trim(),
        estimatedPrice: newEstimated ? parseFloat(newEstimated) : undefined,
        assignedToId: newAssigned || undefined,
      });
      setNewName(''); setNewEstimated(''); setNewAssigned('');
      onReload();
    } catch {}
  };

  const openEdit = (item: IEventItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQuantity(String(item.quantity ?? 1));
    setEditEstimated(item.estimatedPrice ? String(item.estimatedPrice) : '');
    setEditActual(item.actualPrice ? String(item.actualPrice) : '');
    setEditStatus(item.status);
    setEditAssigned(item.assignedToId ?? '');
    setEditNotes(item.notes ?? '');
    setEditDialog(true);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      await api.updateEventItem(event.id, editingItem.id, {
        name: editName.trim(),
        quantity: parseFloat(editQuantity) || 1,
        estimatedPrice: editEstimated ? parseFloat(editEstimated) : undefined,
        actualPrice: editActual ? parseFloat(editActual) : undefined,
        status: editStatus,
        assignedToId: editAssigned || undefined,
        notes: editNotes || undefined,
      });
      setEditDialog(false);
      onReload();
    } catch {}
  };

  const toggleStatus = async (item: IEventItem) => {
    const nextStatus = item.status === 'PENDING' ? 'BOUGHT' : item.status === 'BOUGHT' ? 'SKIPPED' : 'PENDING';
    try {
      await api.updateEventItem(event.id, item.id, { status: nextStatus });
      onReload();
    } catch {}
  };

  const deleteItem = async (itemId: string) => {
    try { await api.deleteEventItem(event.id, itemId); onReload(); } catch {}
  };

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    const m = members.find((m) => m.userId === id);
    return m?.nickname || m?.username || null;
  };

  const sorted = [...(event.items ?? [])].sort((a, b) => {
    const order: Record<string, number> = { PENDING: 0, BOUGHT: 1, SKIPPED: 2 };
    return (order[a.status] ?? 0) - (order[b.status] ?? 0) || a.sortOrder - b.sortOrder;
  });

  const totalEstimated = sorted.reduce((s, i) => s + (i.estimatedPrice ?? 0) * (i.quantity ?? 1), 0);
  const totalActual = sorted.filter(i => i.status === 'BOUGHT').reduce((s, i) => s + (i.actualPrice ?? i.estimatedPrice ?? 0) * (i.quantity ?? 1), 0);

  return (
    <div className="space-y-4">
      {/* Quick add */}
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nazwa produktu..."
          className="flex-1" onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <Input value={newEstimated} onChange={(e) => setNewEstimated(e.target.value)} placeholder="Cena"
          type="number" step="0.01" className="w-24" />
        {members.length > 0 && (
          <Select value={newAssigned} onValueChange={setNewAssigned}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Kto?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nikt</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>{m.nickname || m.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={addItem} disabled={!newName.trim()}><Plus className="h-4 w-4" /></Button>
      </div>

      {/* Summary */}
      {sorted.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Szacowany koszt: <strong>{formatCurrency(totalEstimated)}</strong></span>
          <span className="text-muted-foreground">Kupione za: <strong>{formatCurrency(totalActual)}</strong></span>
          <span className="text-muted-foreground">
            Postęp: <strong>{sorted.filter(i => i.status === 'BOUGHT').length}/{sorted.length}</strong>
          </span>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-1">
        {sorted.map((item) => {
          const st = ITEM_STATUS[item.status];
          const assignedName = getMemberName(item.assignedToId);
          return (
            <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group ${item.status === 'BOUGHT' ? 'opacity-60' : ''} ${item.status === 'SKIPPED' ? 'opacity-40' : ''}`}>
              <Checkbox
                checked={item.status === 'BOUGHT'}
                onCheckedChange={() => toggleStatus(item)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${item.status !== 'PENDING' ? 'line-through' : ''}`}>{item.name}</span>
                  {item.quantity > 1 && <span className="text-xs text-muted-foreground">×{item.quantity}</span>}
                  <Badge variant="outline" className={`text-xs px-1.5 py-0 ${st.color}`}>{st.label}</Badge>
                  {assignedName && <span className="text-xs text-muted-foreground">({assignedName})</span>}
                </div>
                {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {item.estimatedPrice !== null && (
                  <span className="text-muted-foreground">{formatCurrency(item.estimatedPrice * (item.quantity ?? 1))}</span>
                )}
                {item.actualPrice !== null && (
                  <span className="font-medium">{formatCurrency(item.actualPrice * (item.quantity ?? 1))}</span>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Dodaj produkty do listy zakupów</p>
        )}
      </div>

      {/* Edit item dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj produkt</DialogTitle>
            <DialogDescription>Zmień szczegóły produktu</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Ilość</Label><Input type="number" step="0.001" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} /></div>
              <div><Label>Cena szacowana</Label><Input type="number" step="0.01" value={editEstimated} onChange={(e) => setEditEstimated(e.target.value)} /></div>
              <div><Label>Cena rzeczywista</Label><Input type="number" step="0.01" value={editActual} onChange={(e) => setEditActual(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ITEM_STATUS) as [EventItemStatus, { label: string }][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Przypisane do</Label>
                <Select value={editAssigned} onValueChange={setEditAssigned}>
                  <SelectTrigger><SelectValue placeholder="Nikt" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nikt</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.nickname || m.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notatki</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Anuluj</Button>
            <Button onClick={saveEdit}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Todos Tab ────────────────────────────────────────
function TodosTab({ event, members, onReload }: {
  event: IEvent; members: Member[]; onReload: () => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<string>('MEDIUM');
  const [newAssigned, setNewAssigned] = useState('');

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    try {
      await api.addEventTodo(event.id, {
        title: newTitle.trim(),
        priority: newPriority,
        assignedToId: newAssigned || undefined,
      });
      setNewTitle(''); setNewPriority('MEDIUM'); setNewAssigned('');
      onReload();
    } catch {}
  };

  const toggle = async (todoId: string) => {
    try { await api.toggleEventTodo(event.id, todoId); onReload(); } catch {}
  };

  const deleteTodo = async (todoId: string) => {
    try { await api.deleteEventTodo(event.id, todoId); onReload(); } catch {}
  };

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    const m = members.find((m) => m.userId === id);
    return m?.nickname || m?.username || null;
  };

  const sorted = [...(event.todos ?? [])].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    const pri: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
  });

  const completed = sorted.filter(t => t.isCompleted).length;

  return (
    <div className="space-y-4">
      {/* Quick add */}
      <div className="flex gap-2">
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nowe zadanie..."
          className="flex-1" onKeyDown={(e) => e.key === 'Enter' && addTodo()} />
        <Select value={newPriority} onValueChange={setNewPriority}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(PRIORITY_CONFIG) as [TodoPriority, { label: string }][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {members.length > 0 && (
          <Select value={newAssigned} onValueChange={setNewAssigned}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Kto?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nikt</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>{m.nickname || m.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={addTodo} disabled={!newTitle.trim()}><Plus className="h-4 w-4" /></Button>
      </div>

      {sorted.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Wykonane: <strong>{completed}/{sorted.length}</strong>
          {sorted.length > 0 && (
            <Progress value={(completed / sorted.length) * 100} className="h-1.5 mt-1" />
          )}
        </div>
      )}

      {/* Todos list */}
      <div className="space-y-1">
        {sorted.map((todo) => {
          const pri = PRIORITY_CONFIG[todo.priority];
          const assignedName = getMemberName(todo.assignedToId);
          return (
            <div key={todo.id} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group ${todo.isCompleted ? 'opacity-50' : ''}`}>
              <Checkbox checked={todo.isCompleted} onCheckedChange={() => toggle(todo.id)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`${todo.isCompleted ? 'line-through text-muted-foreground' : 'font-medium'}`}>{todo.title}</span>
                  <Badge variant="outline" className={`text-xs px-1.5 py-0 ${pri.color}`}>{pri.label}</Badge>
                  {assignedName && <span className="text-xs text-muted-foreground">({assignedName})</span>}
                </div>
                {todo.description && <p className="text-xs text-muted-foreground mt-0.5">{todo.description}</p>}
                {todo.dueDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />{formatDate(todo.dueDate)}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => deleteTodo(todo.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Dodaj zadania do wykonania</p>
        )}
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────
function NotesTab({ event, onReload }: { event: IEvent; onReload: () => void }) {
  const [addDialog, setAddDialog] = useState(false);
  const [editNote, setEditNote] = useState<IEventNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const openAdd = () => { setTitle(''); setContent(''); setEditNote(null); setAddDialog(true); };
  const openEdit = (note: IEventNote) => { setEditNote(note); setTitle(note.title); setContent(note.content); setAddDialog(true); };

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      if (editNote) {
        await api.updateEventNote(event.id, editNote.id, { title: title.trim(), content: content.trim() });
      } else {
        await api.addEventNote(event.id, { title: title.trim(), content: content.trim() });
      }
      setAddDialog(false);
      onReload();
    } catch {}
  };

  const deleteNote = async (noteId: string) => {
    try { await api.deleteEventNote(event.id, noteId); onReload(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-2" />Dodaj notatkę</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(event.notes ?? []).map((note) => (
          <Card key={note.id} className="group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold">{note.title}</h4>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(note)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteNote(note.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-2">{formatDate(note.createdAt)}</p>
            </CardContent>
          </Card>
        ))}
        {(event.notes ?? []).length === 0 && (
          <p className="text-center text-muted-foreground py-8 col-span-2">Brak notatek — dodaj pierwszą</p>
        )}
      </div>

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editNote ? 'Edytuj notatkę' : 'Nowa notatka'}</DialogTitle>
            <DialogDescription>Zapisz ważne informacje o wydarzeniu</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Tytuł</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł notatki" /></div>
            <div><Label>Treść</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Treść notatki..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={save} disabled={!title.trim() || !content.trim()}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────
function ExpensesTab({ event, categories, members, onReload }: {
  event: IEvent; categories: Category[]; members: Member[]; onReload: () => void;
}) {
  const [addDialog, setAddDialog] = useState(false);
  const [editExpense, setEditExpense] = useState<IEventExpense | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [personId, setPersonId] = useState('');
  const [notes, setNotes] = useState('');

  const openAdd = () => {
    setEditExpense(null); setName(''); setAmount('');
    setDate(new Date().toISOString().substring(0, 10));
    setCategoryId(''); setPersonId(''); setNotes('');
    setAddDialog(true);
  };

  const openEdit = (exp: IEventExpense) => {
    setEditExpense(exp); setName(exp.name); setAmount(String(exp.amount));
    setDate(exp.date?.substring(0, 10) ?? ''); setCategoryId(exp.categoryId ?? '');
    setPersonId(exp.personId ?? ''); setNotes(exp.notes ?? '');
    setAddDialog(true);
  };

  const save = async () => {
    if (!name.trim() || !amount || !date) return;
    try {
      const data = {
        name: name.trim(),
        amount: parseFloat(amount),
        date,
        categoryId: categoryId || undefined,
        personId: personId || undefined,
        notes: notes || undefined,
      };
      if (editExpense) {
        await api.updateEventExpense(event.id, editExpense.id, data);
      } else {
        await api.addEventExpense(event.id, data);
      }
      setAddDialog(false);
      onReload();
    } catch {}
  };

  const deleteExpense = async (expId: string) => {
    try { await api.deleteEventExpense(event.id, expId); onReload(); } catch {}
  };

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;
  const getMemberName = (id: string | null) => {
    if (!id) return null;
    const m = members.find((m) => m.userId === id);
    return m?.nickname || m?.username || null;
  };

  const totalExpenses = (event.expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  (event.expenses ?? []).forEach((e) => {
    const cat = getCategoryName(e.categoryId) || 'Bez kategorii';
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Łącznie: <strong className="text-foreground">{formatCurrency(totalExpenses)}</strong>
          {event.budgetLimit && event.budgetLimit > 0 && (
            <span> z {formatCurrency(event.budgetLimit)}</span>
          )}
        </div>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-2" />Dodaj wydatek</Button>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <Badge key={cat} variant="outline" className="text-xs">
              {cat}: {formatCurrency(amt)}
            </Badge>
          ))}
        </div>
      )}

      {/* Expenses list */}
      <div className="space-y-2">
        {(event.expenses ?? []).map((exp) => {
          const catName = getCategoryName(exp.categoryId);
          const memberName = getMemberName(exp.personId);
          return (
            <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg border group hover:bg-muted/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{exp.name}</span>
                  {catName && <Badge variant="outline" className="text-xs">{catName}</Badge>}
                  {memberName && <span className="text-xs text-muted-foreground">({memberName})</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(exp.date)}
                  {exp.notes && ` · ${exp.notes}`}
                </div>
              </div>
              <span className="font-semibold">{formatCurrency(exp.amount)}</span>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExpense(exp.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {(event.expenses ?? []).length === 0 && (
          <p className="text-center text-muted-foreground py-8">Brak wydatków — dodaj pierwszy</p>
        )}
      </div>

      {/* Add / Edit expense dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editExpense ? 'Edytuj wydatek' : 'Nowy wydatek'}</DialogTitle>
            <DialogDescription>Dodaj wydatek powiązany z wydarzeniem</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Kwota (PLN) *</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>Data *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Kategoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Brak</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Osoba</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Brak</SelectItem>
                    {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.nickname || m.username}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notatki</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={save} disabled={!name.trim() || !amount || !date}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Event Detail View ────────────────────────────────
function EventDetailView({ event, categories, members, onBack, onReload, onEdit }: {
  event: IEvent;
  categories: Category[];
  members: Member[];
  onBack: () => void;
  onReload: () => void;
  onEdit: () => void;
}) {
  const cfg = STATUS_CONFIG[event.status];
  const StatusIcon = cfg.icon;
  const budgetProgress = event.budgetLimit && event.budgetLimit > 0
    ? Math.min(100, ((event.totalExpenses ?? 0) / event.budgetLimit) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {event.icon && <span className="text-3xl">{event.icon}</span>}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{event.name}</h1>
              <Badge variant="outline" className={cfg.color}>
                <StatusIcon className="h-3 w-3 mr-1" />{cfg.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(event.startDate)}
                {event.endDate && ` – ${formatDate(event.endDate)}`}
              </span>
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{event.location}
                </span>
              )}
              {event.daysUntil != null && (event.status === 'PLANNED' || event.status === 'ACTIVE') && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {event.daysUntil === 0 ? 'Dzisiaj!' : event.daysUntil === 1 ? 'Jutro' : `Za ${event.daysUntil} dni`}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit2 className="h-4 w-4 mr-2" />Edytuj
        </Button>
      </div>

      {event.description && (
        <p className="text-muted-foreground">{event.description}</p>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold">{event.itemsBought ?? 0}/{event.itemsTotal ?? 0}</div>
            <div className="text-xs text-muted-foreground">Zakupy</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold">{event.todosCompleted ?? 0}/{event.todosTotal ?? 0}</div>
            <div className="text-xs text-muted-foreground">Zadania</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold">{formatCurrency(event.totalEstimated ?? 0)}</div>
            <div className="text-xs text-muted-foreground">Szacowane zakupy</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold">{formatCurrency(event.totalExpenses ?? 0)}</div>
            <div className="text-xs text-muted-foreground">Wydatki</div>
          </CardContent>
        </Card>
        {event.budgetLimit != null && event.budgetLimit > 0 && (
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-lg font-bold">{Math.round(budgetProgress ?? 0)}%</div>
              <div className="text-xs text-muted-foreground">Budżet</div>
              <Progress value={budgetProgress ?? 0} className="h-1 mt-1" />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="shopping" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shopping" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Zakupy</span>
            {(event.itemsTotal ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{event.itemsTotal}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="todos" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Zadania</span>
            {(event.todosTotal ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{event.todosTotal}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Notatki</span>
            {(event.notes?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{event.notes?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Wydatki</span>
            {(event.expenses?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{event.expenses?.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shopping" className="mt-4">
          <ShoppingListTab event={event} categories={categories} members={members} onReload={onReload} />
        </TabsContent>
        <TabsContent value="todos" className="mt-4">
          <TodosTab event={event} members={members} onReload={onReload} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesTab event={event} onReload={onReload} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab event={event} categories={categories} members={members} onReload={onReload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function EventsPage() {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [stats, setStats] = useState<IEventStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('__all');

  // Views
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<IEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsData, categoriesData, membersData, statsData] = await Promise.all([
        api.getEvents({ status: filterStatus !== '__all' ? filterStatus : undefined, search: search || undefined }),
        api.getCategories(),
        api.getFamilyMembers().catch(() => []),
        api.getEventStats(),
      ]);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData as Category[] : []);
      setMembers(Array.isArray(membersData) ? membersData as Member[] : []);
      setStats(statsData);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadEvent = useCallback(async (eventId: string) => {
    try {
      const data = await api.getEvent(eventId);
      setSelectedEvent(data);
    } catch {}
  }, []);

  const handleOpenEvent = (event: IEvent) => {
    setSelectedEvent(event);
  };

  const handleEdit = (event: IEvent) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    try { await api.duplicateEvent(id); loadData(); } catch {}
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteEvent(deleteId);
      if (selectedEvent?.id === deleteId) setSelectedEvent(null);
      loadData();
    } catch {}
    finally { setDeleteId(null); }
  };

  const handleFormSave = () => {
    loadData();
    setEditingEvent(null);
  };

  // Detail view
  if (selectedEvent) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <EventDetailView
          event={selectedEvent}
          categories={categories}
          members={members}
          onBack={() => { setSelectedEvent(null); loadData(); }}
          onReload={() => loadEvent(selectedEvent.id)}
          onEdit={() => handleEdit(selectedEvent)}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wydarzenia</h1>
          <p className="text-muted-foreground text-sm">Planuj zakupy, zadania i wydatki na wydarzenia</p>
        </div>
        <Button onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nowe wydarzenie
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold">{stats.totalEvents}</div>
              <div className="text-xs text-muted-foreground">Wszystkich</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-green-600">{stats.activeEvents}</div>
              <div className="text-xs text-muted-foreground">Aktywnych</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{stats.upcomingCount}</div>
              <div className="text-xs text-muted-foreground">Nadchodzących</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold">{formatCurrency(stats.totalBudget)}</div>
              <div className="text-xs text-muted-foreground">Budżet</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold">{formatCurrency(stats.totalSpent)}</div>
              <div className="text-xs text-muted-foreground">Wydano</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj wydarzeń..."
            className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Wszystkie statusy" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Wszystkie statusy</SelectItem>
            {(Object.entries(STATUS_CONFIG) as [EventStatus, typeof STATUS_CONFIG[EventStatus]][]).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">Brak wydarzeń</h3>
          <p className="text-muted-foreground text-sm mb-4">Utwórz pierwsze wydarzenie, aby zacząć planować</p>
          <Button onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nowe wydarzenie
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => handleOpenEvent(event)}
              onEdit={() => handleEdit(event)}
              onDuplicate={() => handleDuplicate(event.id)}
              onDelete={() => setDeleteId(event.id)}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        onSave={handleFormSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wydarzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Zostaną usunięte wszystkie zakupy, zadania, notatki i wydatki powiązane z tym wydarzeniem.
              Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
