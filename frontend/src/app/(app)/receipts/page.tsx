'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { compressImage, fileToDataUrl, runReceiptOcr } from '@/lib/receipt-ocr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Progress } from '@/components/ui/progress';
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
import {
  Plus,
  Trash2,
  Camera,
  Edit2,
  Copy,
  MoreHorizontal,
  Search,
  Filter,
  Download,
  LayoutGrid,
  LayoutList,
  Receipt,
  TrendingUp,
  ShoppingBag,
  ArrowUpDown,
  X,
  ImageIcon,
  FileText,
  Loader2,
} from 'lucide-react';
import type { IReceipt, IReceiptStats } from '@shared/models';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pl-PL');
}

function isPdfDataUrl(value?: string | null) {
  return typeof value === 'string' && value.startsWith('data:application/pdf');
}

function receiptStatusLabel(receipt: IReceipt): { label: string; className: string } {
  if (receipt.ocrStatus === 'PENDING') {
    return { label: 'Przetwarzanie OCR', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
  }
  if (receipt.ocrStatus === 'FAILED') {
    return { label: 'OCR nieudany', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
  }
  if (receipt.isApproved) {
    return { label: 'Zatwierdzony', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
  }
  return { label: 'Wymaga zatwierdzenia', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
}

// ─── Types ──────────────────────────────────────────
interface Category { id: string; name: string; color: string | null; icon: string | null; }
interface Store { id: string; name: string; }
type SortKey = 'date' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';

// ─── Receipt Form Dialog ────────────────────────────
interface ReceiptFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receipt?: IReceipt | null;
  categories: Category[];
  stores: Store[];
  members: any[];
  onSaved: () => void;
}

function ReceiptFormDialog({ open, onOpenChange, receipt, categories, stores, members, onSaved }: ReceiptFormProps) {
  const [mode, setMode] = useState<'manual' | 'scanner'>('manual');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [personId, setPersonId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [items, setItems] = useState<{ name: string; quantity: number; unitPrice: number; total: number; categoryId?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [processingBackgroundScan, setProcessingBackgroundScan] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (receipt) {
        setDescription(receipt.description);
        setAmount(String(receipt.amount));
        setDate(new Date(receipt.date).toISOString().split('T')[0]);
        setCategoryId(receipt.categoryId ?? '');
        setPersonId(receipt.personId ?? '');
        setStoreId(receipt.storeId ?? '');
        setNotes(receipt.notes ?? '');
        setImageUrl(receipt.imageUrl ?? '');
        setItems(receipt.items?.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, categoryId: i.categoryId ?? undefined })) ?? []);
        setMode('manual');
      } else {
        setDescription(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]);
        setCategoryId(''); setPersonId(''); setStoreId(''); setNotes('');
        setImageUrl(''); setItems([]); setMode('manual');
      }
    }
  }, [open, receipt]);

  const handleBackgroundScan = async (file?: File | null) => {
    if (!file || processingBackgroundScan) return;

    const today = new Date().toISOString().split('T')[0];
    const fallbackDescription = file.name?.replace(/\.[^.]+$/, '') || 'Paragon';
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    setProcessingBackgroundScan(true);

    try {
      const rawDataUrl = await fileToDataUrl(file);
      const filePayload = isPdf ? rawDataUrl : await compressImage(rawDataUrl);
      onOpenChange(false);

      const receiptCreated = await api.createReceipt({
        description: fallbackDescription,
        amount: 0,
        currency: 'PLN',
        date: today,
        imageUrl: filePayload,
        ocrStatus: isPdf ? 'FAILED' : 'PENDING',
        ocrError: isPdf ? 'Plik PDF został dodany. Uzupełnij dane ręcznie.' : undefined,
        isApproved: false,
      }, { notifySuccess: false });

      window.dispatchEvent(new Event('financio:summary-refresh'));
      window.dispatchEvent(new Event('financio:receipts-refresh'));
      if (isPdf) {
        toastSuccess('Paragon PDF dodany. Uzupełnij dane ręcznie.');
      } else {
        toastSuccess('Paragon dodany. Trwa przetwarzanie OCR w tle.');
      }

      if (isPdf) {
        onSaved();
        return;
      }

      try {
        const parsed = await runReceiptOcr(file);
        const hasUsefulData = parsed.total > 0 || parsed.items.length > 0 || !!parsed.storeName;

        if (!hasUsefulData) {
          await api.updateReceipt(receiptCreated.id, {
            ocrStatus: 'FAILED',
            ocrError: 'Nie udało się odczytać danych z OCR.',
            notes: parsed.rawText?.slice(0, 2000) || undefined,
          }, { notifySuccess: false, suppressErrorToast: true });
        } else {
          await api.updateReceipt(receiptCreated.id, {
            description: parsed.storeName || fallbackDescription,
            amount: parsed.total > 0 ? parsed.total : 0,
            date: parsed.date || today,
            items: parsed.items,
            notes: parsed.rawText?.slice(0, 2000) || undefined,
            ocrStatus: 'COMPLETED',
            ocrError: null,
          }, { notifySuccess: false, suppressErrorToast: true });
        }
      } catch (ocrError) {
        console.error('Background OCR failed:', ocrError);
        await api.updateReceipt(receiptCreated.id, {
          ocrStatus: 'FAILED',
          ocrError: 'Błąd podczas OCR. Uzupełnij dane ręcznie.',
        }, { notifySuccess: false, suppressErrorToast: true });
      }

      window.dispatchEvent(new Event('financio:summary-refresh'));
      window.dispatchEvent(new Event('financio:receipts-refresh'));
      onSaved();
    } catch (e) {
      console.error(e);
      toastError('Nie udało się uruchomić skanowania paragonu.');
    } finally {
      setProcessingBackgroundScan(false);
    }
  };

  const handleSave = async () => {
    if (!description || !amount) return;
    setSaving(true);
    try {
      const data: any = {
        description,
        amount: Number(amount),
        date,
        categoryId: categoryId || undefined,
        personId: personId || undefined,
        storeId: storeId || undefined,
        notes: notes || undefined,
        imageUrl: imageUrl || undefined,
        items: items.length > 0 ? items : undefined,
      };

      if (receipt) {
        await api.updateReceipt(receipt.id, data);
      } else {
        await api.createReceipt(data);
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, total: 0 }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      updated[idx].total = Math.round(updated[idx].quantity * updated[idx].unitPrice * 100) / 100;
    }
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{receipt ? 'Edytuj paragon' : 'Nowy paragon'}</DialogTitle>
          <DialogDescription>{receipt ? 'Zmień dane paragonu' : 'Dodaj nowy paragon ręcznie lub zeskanuj'}</DialogDescription>
        </DialogHeader>

        {!receipt && (
          <div className="flex gap-2 mb-2">
            <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('manual')}>
              <FileText className="h-4 w-4 mr-1" /> Ręcznie
            </Button>
            <Button variant={mode === 'scanner' ? 'default' : 'outline'} size="sm" onClick={() => setMode('scanner')}>
              <Camera className="h-4 w-4 mr-1" /> Skaner
            </Button>
          </div>
        )}

        {mode === 'scanner' ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Po zrobieniu zdjęcia okno zamknie się natychmiast, a OCR będzie kontynuowany w tle.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button className="h-11 gap-2" onClick={() => cameraInputRef.current?.click()} disabled={processingBackgroundScan}>
                {processingBackgroundScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Aparat
              </Button>
              <Button variant="outline" className="h-11 gap-2" onClick={() => galleryInputRef.current?.click()} disabled={processingBackgroundScan}>
                {processingBackgroundScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Galeria
              </Button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleBackgroundScan(e.target.files?.[0])}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => void handleBackgroundScan(e.target.files?.[0])}
            />

            <Button variant="ghost" onClick={() => setMode('manual')}>
              Przejdź do formularza ręcznego
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Opis *</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="np. Zakupy Biedronka" />
              </div>
              <div>
                <Label>Kwota (PLN) *</Label>
                <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            {/* Category, Store, Person */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Kategoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon && <span className="mr-1">{c.icon}</span>}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sklep</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Osoba</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    {members.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notatki</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Image */}
            {imageUrl && (
              <div className="relative">
                <Label>Zdjęcie paragonu</Label>
                {isPdfDataUrl(imageUrl) ? (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-primary hover:bg-accent/60"
                  >
                    <FileText className="h-4 w-4" />
                    Otwórz podgląd PDF
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Paragon" className="max-h-48 rounded-lg border object-contain mt-1" />
                )}
                <Button variant="ghost" size="icon" className="absolute top-0 right-0" onClick={() => setImageUrl('')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Pozycje paragonu</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Pozycja
                </Button>
              </div>
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {idx === 0 && <Label className="text-xs">Nazwa</Label>}
                        <Input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Nazwa" className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">Ilość</Label>}
                        <Input type="number" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">Cena jedn.</Label>}
                        <Input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs">Razem</Label>}
                        <Input type="number" step="0.01" value={item.total} readOnly className="h-8 text-sm bg-muted" />
                      </div>
                      <div className="col-span-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
              <Button onClick={handleSave} disabled={saving || !description || !amount}>
                {saving ? 'Zapisywanie...' : (receipt ? 'Zapisz' : 'Dodaj')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Receipt Card (Grid View) ───────────────────────
function ReceiptCard({ receipt, categories, onEdit, onDelete, onDuplicate, onCreateExpense }: {
  receipt: IReceipt;
  categories: Category[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCreateExpense: () => void;
}) {
  const cat = categories.find(c => c.id === receipt.categoryId);
  const status = receiptStatusLabel(receipt);
  const canApprove = receipt.ocrStatus !== 'PENDING' && !receipt.isApproved;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{receipt.description}</p>
            <p className="text-xs text-muted-foreground">{formatDate(receipt.date)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Edit2 className="h-3 w-3 mr-2" /> Edytuj</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}><Copy className="h-3 w-3 mr-2" /> Duplikuj</DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateExpense} disabled={!canApprove}><TrendingUp className="h-3 w-3 mr-2" /> Zatwierdź</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Usuń</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">{formatPLN(receipt.amount)}</span>
          {cat && <Badge variant="secondary" style={{ backgroundColor: cat.color ?? undefined }} className="text-xs">{cat.icon} {cat.name}</Badge>}
        </div>

        <Badge className={status.className}>{status.label}</Badge>

        {receipt.items && receipt.items.length > 0 && (
          <p className="text-xs text-muted-foreground">{receipt.items.length} pozycji</p>
        )}

        {receipt.tags && receipt.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {receipt.tags.map(t => <Badge key={t.id} variant="outline" className="text-xs">{t.name}</Badge>)}
          </div>
        )}

        {receipt.imageUrl && <ImageIcon className="h-3 w-3 text-muted-foreground" />}

        {canApprove && (
          <Button size="sm" className="w-full" onClick={onCreateExpense}>
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Zatwierdź
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stats Cards ────────────────────────────────────
function StatsBar({ stats }: { stats: IReceiptStats | null }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Paragonów</p>
          <p className="text-xl font-bold">{stats.totalReceipts}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Suma</p>
          <p className="text-xl font-bold">{formatPLN(stats.totalAmount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Średnia</p>
          <p className="text-xl font-bold">{formatPLN(stats.averageAmount)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Top sklep</p>
          <p className="text-xl font-bold truncate">{stats.byStore?.[0]?.store ?? '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Image Viewer Dialog ────────────────────────────
function ImageViewer({ imageUrl, open, onClose }: { imageUrl: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Zdjęcie paragonu</DialogTitle></DialogHeader>
        {isPdfDataUrl(imageUrl) ? (
          <iframe src={imageUrl} title="Paragon PDF" className="h-[70vh] w-full rounded-lg border" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Paragon" className="w-full rounded-lg" />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV Export ─────────────────────────────────────
function exportToCSV(receipts: IReceipt[]) {
  const header = 'Data;Opis;Kwota;Kategoria;Sklep;Notatki\n';
  const rows = receipts.map(r =>
    `${formatDate(r.date)};${r.description};${r.amount};${r.categoryId ?? ''};${r.storeId ?? ''};${r.notes ?? ''}`
  ).join('\n');

  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paragony_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ──────────────────────────────────────
export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<IReceipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<IReceiptStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Dialogs
  const [editReceipt, setEditReceipt] = useState<IReceipt | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [receiptsData, categoriesData, storesData, membersData, statsData] = await Promise.all([
        api.getReceipts({ from: filterFrom || undefined, to: filterTo || undefined, categoryId: filterCategory || undefined, storeId: filterStore || undefined, search: search || undefined }),
        api.getCategories(),
        api.getStores(),
        api.getFamilyMembers().catch(() => []),
        api.getReceiptStats(filterFrom || undefined, filterTo || undefined),
      ]);
      setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData as Category[] : []);
      setStores(Array.isArray(storesData) ? storesData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setStats(statsData);
    } catch { setReceipts([]); }
    finally { setLoading(false); }
  }, [filterFrom, filterTo, filterCategory, filterStore, search]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => {
      loadData();
    };
    window.addEventListener('financio:receipts-refresh', handler);
    return () => window.removeEventListener('financio:receipts-refresh', handler);
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.deleteReceipt(deleteId); setDeleteId(null); loadData(); } catch (e) { console.error(e); }
  };

  const handleDuplicate = async (id: string) => {
    try { await api.duplicateReceipt(id); loadData(); } catch (e) { console.error(e); }
  };

  const handleApproveReceipt = async (id: string) => {
    try { await api.createExpenseFromReceipt(id); } catch (e) { console.error(e); }
    loadData();
    window.dispatchEvent(new Event('financio:summary-refresh'));
  };

  const handleEditOpen = (r: IReceipt) => {
    setEditReceipt(r);
    setShowForm(true);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedReceipts = useMemo(() => {
    const sorted = [...receipts];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortKey === 'amount') cmp = a.amount - b.amount;
      else cmp = a.description.localeCompare(b.description);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [receipts, sortKey, sortDir]);

  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Paragony
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(sortedReceipts)}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => { setEditReceipt(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj paragon
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj paragonów..." className="pl-8 h-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" /> Filtry {showFilters ? '▲' : '▼'}
            </Button>
            <div className="flex border rounded-md">
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('table')}>
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
              <div>
                <Label className="text-xs">Od</Label>
                <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Do</Label>
                <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Kategoria</Label>
                <Select value={filterCategory} onValueChange={v => setFilterCategory(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sklep</Label>
                <Select value={filterStore} onValueChange={v => setFilterStore(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('date')}>
                    Data {sortKey === 'date' && <ArrowUpDown className="inline h-3 w-3" />}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('description')}>
                    Opis {sortKey === 'description' && <ArrowUpDown className="inline h-3 w-3" />}
                  </TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                    Kwota {sortKey === 'amount' && <ArrowUpDown className="inline h-3 w-3" />}
                  </TableHead>
                  <TableHead>Pozycje</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Brak paragonów</TableCell>
                  </TableRow>
                ) : sortedReceipts.map((r) => {
                  const cat = getCategoryName(r.categoryId);
                  const status = receiptStatusLabel(r);
                  const canApprove = r.ocrStatus !== 'PENDING' && !r.isApproved;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => handleEditOpen(r)}>
                      <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1">
                          {r.imageUrl && <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                          {r.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cat && <Badge variant="secondary" className="text-xs">{cat.icon} {cat.name}</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPLN(r.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.items && r.items.length > 0 ? `${r.items.length} poz.` : '—'}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {canApprove && (
                            <Button size="sm" className="h-7 px-2" onClick={() => handleApproveReceipt(r.id)}>
                              Zatwierdź
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditOpen(r)}><Edit2 className="h-3 w-3 mr-2" /> Edytuj</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(r.id)}><Copy className="h-3 w-3 mr-2" /> Duplikuj</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleApproveReceipt(r.id)} disabled={!canApprove}><TrendingUp className="h-3 w-3 mr-2" /> Zatwierdź</DropdownMenuItem>
                              {r.imageUrl && <DropdownMenuItem onClick={() => setViewImage(r.imageUrl!)}><ImageIcon className="h-3 w-3 mr-2" /> Plik</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => setDeleteId(r.id)} className="text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Usuń</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedReceipts.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="text-center py-8 text-muted-foreground">Brak paragonów</CardContent>
            </Card>
          ) : sortedReceipts.map(r => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              categories={categories}
              onEdit={() => handleEditOpen(r)}
              onDelete={() => setDeleteId(r.id)}
              onDuplicate={() => handleDuplicate(r.id)}
              onCreateExpense={() => handleApproveReceipt(r.id)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <ReceiptFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditReceipt(null); }}
        receipt={editReceipt}
        categories={categories}
        stores={stores}
        members={members}
        onSaved={loadData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć paragon?</AlertDialogTitle>
            <AlertDialogDescription>Ta operacja jest nieodwracalna. Paragon zostanie trwale usunięty.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer */}
      {viewImage && <ImageViewer imageUrl={viewImage} open={!!viewImage} onClose={() => setViewImage(null)} />}
    </div>
  );
}
