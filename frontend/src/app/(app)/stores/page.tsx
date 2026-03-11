'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Trash2, Edit2, MoreHorizontal, Store, MapPin } from 'lucide-react';
import type { IStore } from '@shared/models';

 

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

interface Category { id: string; name: string; color: string | null; icon: string | null; }

// ─── Store Form ─────────────────────────────────────
function StoreFormDialog({ open, onOpenChange, store, categories, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  store?: IStore | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [icon, setIcon] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (store) {
        setName(store.name);
        setDefaultCategoryId(store.defaultCategoryId ?? '');
        setIcon(store.icon ?? '');
        setAddress(store.address ?? '');
        setNotes(store.notes ?? '');
      } else {
        setName(''); setDefaultCategoryId(''); setIcon(''); setAddress(''); setNotes('');
      }
    }
  }, [open, store]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        defaultCategoryId: defaultCategoryId || undefined,
        icon: icon || undefined,
        address: address || undefined,
        notes: notes || undefined,
      };
      if (store) {
        await api.updateStore(store.id, data);
      } else {
        await api.createStore(data);
      }
      onOpenChange(false);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{store ? 'Edytuj sklep' : 'Nowy sklep'}</DialogTitle>
          <DialogDescription>{store ? 'Zmień dane sklepu' : 'Dodaj nowy sklep / kontrahenta'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nazwa *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Biedronka" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ikona</Label>
              <Input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🏪" />
            </div>
            <div>
              <Label>Domyślna kategoria</Label>
              <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
                <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Adres</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="ul. Przykładowa 1" />
          </div>
          <div>
            <Label>Notatki</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Zapisywanie...' : (store ? 'Zapisz' : 'Dodaj')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────
export default function StoresPage() {
  const [stores, setStores] = useState<IStore[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editStore, setEditStore] = useState<IStore | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [storesData, categoriesData] = await Promise.all([
        api.getStores(),
        api.getCategories(),
      ]);
      setStores(Array.isArray(storesData) ? storesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData as Category[] : []);
    } catch { setStores([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.deleteStore(deleteId); setDeleteId(null); loadData(); } catch (e) { console.error(e); }
  };

  const totalSpent = stores.reduce((sum, s) => sum + (s.totalSpent ?? 0), 0);

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" /> Sklepy / Kontrahenci
          </h1>
          <p className="text-sm text-muted-foreground">
            {stores.length} sklepów · Suma: {formatPLN(totalSpent)}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditStore(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Dodaj sklep
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Sklepów</p>
            <p className="text-xl font-bold">{stores.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Suma wydatków</p>
            <p className="text-xl font-bold">{formatPLN(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Najczęstszy</p>
            <p className="text-xl font-bold truncate">
              {stores.length > 0 ? [...stores].sort((a, b) => (b.receiptCount ?? 0) - (a.receiptCount ?? 0))[0].name : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Najdroższy</p>
            <p className="text-xl font-bold truncate">
              {stores.length > 0 ? [...stores].sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0))[0].name : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stores.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-8 text-muted-foreground">
              Brak sklepów. Dodaj pierwszy sklep!
            </CardContent>
          </Card>
        ) : stores.map(store => (
          <Card key={store.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{store.icon ?? '🏪'}</span>
                  <div>
                    <p className="font-semibold">{store.name}</p>
                    {store.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {store.address}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditStore(store); setShowForm(true); }}><Edit2 className="h-3 w-3 mr-2" /> Edytuj</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteId(store.id)} className="text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Usuń</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Paragony</p>
                  <p className="font-semibold">{store.receiptCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suma</p>
                  <p className="font-semibold">{formatPLN(store.totalSpent ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Średnia</p>
                  <p className="font-semibold">{formatPLN(store.averageReceipt ?? 0)}</p>
                </div>
              </div>
              {store.lastVisit && (
                <p className="text-xs text-muted-foreground mt-2">
                  Ostatnia wizyta: {new Date(store.lastVisit).toLocaleDateString('pl-PL')}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form Dialog */}
      <StoreFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditStore(null); }}
        store={editStore}
        categories={categories}
        onSaved={loadData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć sklep?</AlertDialogTitle>
            <AlertDialogDescription>Sklep zostanie usunięty. Paragony powiązane z tym sklepem zostaną zachowane.</AlertDialogDescription>
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
