'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { compressImage, fileToDataUrl, parseReceiptText, runReceiptOcr } from '@/lib/receipt-ocr';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tag } from '@/components/Tag';
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
  ArrowUpDown,
  X,
  ImageIcon,
  FileText,
  Loader2,
  Settings,
} from 'lucide-react';
import type { IReceipt, IReceiptStats } from '@shared/models';

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pl-PL');
}

function shiftDateByDays(date: string, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().split('T')[0];
}

function isPdfDataUrl(value?: string | null) {
  return typeof value === 'string' && value.startsWith('data:application/pdf');
}

function dataUrlToFile(dataUrl: string, fallbackName: string): File {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Niepoprawny format pliku paragonu');
  }
  const mime = match[1];
  const bytes = atob(match[2]);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    array[i] = bytes.charCodeAt(i);
  }
  const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg');
  return new File([array], `${fallbackName}.${ext}`, { type: mime });
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
interface TagOption { id: string; name: string; color: string | null; icon: string | null; groupName: string | null; groupId?: string | null; }
interface OcrProposal {
  description?: string | null;
  amount?: number;
  date?: string | null;
  items?: { name: string; quantity: number; unitPrice: number; total: number }[];
  notes?: string;
}
interface ReceiptExpenseMappingConfig {
  amountFieldId?: string | null;
  dateFieldId?: string | null;
  descriptionFieldId?: string | null;
  notesFieldId?: string | null;
  personFieldId?: string | null;
  storeFieldId?: string | null;
  categoryFieldId?: string | null;
  itemsFieldId?: string | null;
  autoTagIds?: string[];
}
type ReceiptSourceFieldId = 'amount' | 'date' | 'description' | 'notes' | 'person' | 'store' | 'category' | 'items' | 'tags';
type ReceiptFieldMode = 'none' | 'map' | 'auto_tags' | 'receipt_configurable';

interface ReceiptFieldConfig {
  mode: ReceiptFieldMode;
  receiptFieldId?: ReceiptSourceFieldId | null;
  autoTagIds?: string[];
  required?: boolean;
}

interface ReceiptConfigState {
  expenseMapping: ReceiptExpenseMappingConfig;
  availableFields: Array<{
    id: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
    currencyOptions?: string[];
    tagGroupId?: string | null;
    allowMultiple?: boolean;
  }>;
  receiptFields: Array<{ id: ReceiptSourceFieldId; name: string }>;
  fieldConfigs: Record<string, ReceiptFieldConfig>;
}

const DEFAULT_RECEIPT_SOURCE_FIELDS: Array<{ id: ReceiptSourceFieldId; name: string }> = [
  { id: 'amount', name: 'Kwota paragonu' },
  { id: 'date', name: 'Data paragonu' },
  { id: 'description', name: 'Opis paragonu' },
  { id: 'notes', name: 'Notatki paragonu' },
  { id: 'person', name: 'Osoba z paragonu' },
  { id: 'store', name: 'Sklep z paragonu' },
  { id: 'category', name: 'Kategoria z paragonu' },
  { id: 'items', name: 'Pozycje paragonu' },
  { id: 'tags', name: 'Tagi paragonu' },
];
type SortKey = 'date' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';

// ─── Receipt Form Dialog ────────────────────────────
interface ReceiptFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receipt?: IReceipt | null;
  stores: Store[];
  tags: TagOption[];
  members: any[];
  receiptConfig: ReceiptConfigState | null;
  onSaved: () => void;
}

function ReceiptFormDialog({ open, onOpenChange, receipt, stores, tags, members, receiptConfig, onSaved }: ReceiptFormProps) {
  const [mode, setMode] = useState<'manual' | 'scanner'>('manual');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [personId, setPersonId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [items, setItems] = useState<{ name: string; quantity: number; unitPrice: number; total: number; categoryId?: string }[]>([]);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [showOcrDetails, setShowOcrDetails] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  const [lastOcrRawText, setLastOcrRawText] = useState('');
  const [ocrRetrySucceeded, setOcrRetrySucceeded] = useState(false);
  const [templateFieldValues, setTemplateFieldValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [processingBackgroundScan, setProcessingBackgroundScan] = useState(false);
  const [ocrProposal, setOcrProposal] = useState<OcrProposal | null>(null);
  const [proposalAccepted, setProposalAccepted] = useState<Record<string, boolean>>({});
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    if (receipt) {
      setDescription(receipt.description);
      setAmount(String(receipt.amount));
      setDate(new Date(receipt.date).toISOString().split('T')[0]);
      setPersonId(receipt.personId ?? '');
      setStoreId(receipt.storeId ?? '');
      setNotes(receipt.notes ?? '');
      setImageUrl(receipt.imageUrl ?? '');
      setItems(receipt.items?.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, categoryId: i.categoryId ?? undefined })) ?? []);
      setTagIds(receipt.tags?.map((t: any) => String(t.id)) ?? []);
      setTemplateFieldValues(((receipt as any).configurableFields as Record<string, unknown>) ?? {});
      setMode('manual');
    } else {
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setPersonId('');
      setStoreId('');
      setNotes('');
      setImageUrl('');
      setTagIds([]);
      setItems([]);
      setTemplateFieldValues({});
      setMode('manual');
    }

    setShowMobilePreview(false);
    setShowOcrDetails(false);
    setOcrRunning(false);
    setOcrProgress(0);
    setOcrLogs([]);
    setLastOcrRawText('');
    setOcrRetrySucceeded(false);
    setOcrProposal(null);
    setProposalAccepted({});
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
        ocrStatus: 'PENDING',
        isApproved: false,
      }, { notifySuccess: false });

      window.dispatchEvent(new Event('financio:summary-refresh'));
      window.dispatchEvent(new Event('financio:receipts-refresh'));
      toastSuccess('Paragon dodany. Trwa przetwarzanie OCR w tle.');

      try {
        let finalDescription = fallbackDescription;
        let finalAmount = 0;
        let finalDate = today;
        let finalItems: Array<{ name: string; quantity: number; unitPrice: number; total: number }> = [];
        let finalNotes = '';
        let hasUsefulData = false;

        if (isPdf) {
          const backendPdf = await api.extractReceiptPdfText(filePayload);
          if (backendPdf.hasText && backendPdf.length >= 40) {
            if (backendPdf.parsed) {
              finalDescription = backendPdf.parsed.description || backendPdf.parsed.storeName || fallbackDescription;
              finalAmount = backendPdf.parsed.total > 0 ? backendPdf.parsed.total : 0;
              finalDate = backendPdf.parsed.date || today;
              finalItems = Array.isArray(backendPdf.parsed.items) ? backendPdf.parsed.items : [];
              finalNotes = (backendPdf.parsed.formattedText || backendPdf.text || '').slice(0, 2000);
              hasUsefulData = finalAmount > 0 || finalItems.length > 0;
            } else {
              const parsed = parseReceiptText(backendPdf.text);
              finalDescription = parsed.storeName || fallbackDescription;
              finalAmount = parsed.total > 0 ? parsed.total : 0;
              finalDate = parsed.date || today;
              finalItems = parsed.items;
              finalNotes = (parsed.rawText || backendPdf.text || '').slice(0, 2000);
              hasUsefulData = finalAmount > 0 || finalItems.length > 0 || !!parsed.storeName;
            }
          }
        }

        if (!hasUsefulData) {
          const parsed = await runReceiptOcr(file);
          if (parsed.rawText && parsed.rawText.length >= 20) {
            try {
              const aiResult = await api.parseReceiptAI(parsed.rawText);
              if (aiResult.parsed) {
                const p = aiResult.parsed;
                finalDescription = p.description || p.storeName || parsed.storeName || fallbackDescription;
                finalAmount = p.total > 0 ? p.total : parsed.total;
                finalDate = p.date || parsed.date || today;
                finalItems = Array.isArray(p.items) && p.items.length > 0 ? p.items : parsed.items;
                finalNotes = (p.formattedText || parsed.rawText || '').slice(0, 2000);
                hasUsefulData = finalAmount > 0 || finalItems.length > 0;
              }
            } catch {
              // AI failed, local OCR result is still usable.
            }
          }

          if (!hasUsefulData) {
            finalDescription = parsed.storeName || fallbackDescription;
            finalAmount = parsed.total > 0 ? parsed.total : 0;
            finalDate = parsed.date || today;
            finalItems = parsed.items;
            finalNotes = (parsed.rawText || '').slice(0, 2000);
            hasUsefulData = finalAmount > 0 || finalItems.length > 0 || !!parsed.storeName;
          }
        }

        if (!hasUsefulData) {
          await api.updateReceipt(receiptCreated.id, {
            ocrStatus: 'FAILED',
            ocrError: 'Nie udało się odczytać danych z OCR.',
            notes: finalNotes || undefined,
          }, { notifySuccess: false, suppressErrorToast: true });
        } else {
          await api.updateReceipt(receiptCreated.id, {
            description: finalDescription,
            amount: finalAmount,
            date: finalDate,
            items: finalItems,
            notes: finalNotes || undefined,
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
        personId: personId || undefined,
        storeId: storeId || undefined,
        notes,
        imageUrl: imageUrl || undefined,
        tagIds,
        configurableFields: templateFieldValues,
        items: items.length > 0 ? items : undefined,
      };

      if (ocrRetrySucceeded) {
        data.ocrStatus = 'COMPLETED';
        data.ocrError = null;
      }

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

  const runOcrAgain = async () => {
    if (!imageUrl || ocrRunning) return;

    setShowOcrDetails(true);
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrLogs(['Rozpoczęto ponowne OCR...']);
    setLastOcrRawText('');
    setOcrProposal(null);
    setProposalAccepted({});

    const buildProposal = (data: { storeName?: string | null; date?: string | null; items?: any[]; total?: number; description?: string | null; formattedText?: string | null; rawText?: string }) => {
      const proposal: OcrProposal = {};
      const newDesc = data.description || data.storeName || null;
      if (newDesc) proposal.description = newDesc;
      if (data.total && data.total > 0) proposal.amount = data.total;
      if (data.date) proposal.date = data.date;
      if (Array.isArray(data.items) && data.items.length > 0) proposal.items = data.items;

      const noteText = data.formattedText || data.rawText;
      if (noteText) proposal.notes = noteText.slice(0, 2000).trim();

      // Auto-accept all fields by default
      const accepted: Record<string, boolean> = {};
      if (proposal.description) accepted.description = true;
      if (proposal.amount) accepted.amount = true;
      if (proposal.date) accepted.date = true;
      if (proposal.items) accepted.items = true;
      if (proposal.notes) accepted.notes = true;

      setOcrProposal(proposal);
      setProposalAccepted(accepted);
    };

    try {
      const sourceFile = dataUrlToFile(imageUrl, receipt?.description || 'paragon');
      const isPdf = sourceFile.type === 'application/pdf' || /\.pdf$/i.test(sourceFile.name);

      if (isPdf) {
        setOcrLogs((prev) => [...prev, 'PDF: próba odczytu tekstu na backendzie (+ AI parsing)']);
        const backendPdf = await api.extractReceiptPdfText(imageUrl);
        if (Array.isArray((backendPdf as any).diagnostics) && (backendPdf as any).diagnostics.length > 0) {
          setOcrLogs((prev) => [...prev, ...((backendPdf as any).diagnostics as string[]).map((x) => `PDF backend: ${x}`)]);
        }
        if (backendPdf.hasText && backendPdf.length >= 40) {
          setOcrLogs((prev) => [...prev, `PDF: backend odczytał tekst (${backendPdf.length} znaków) źródło=${(backendPdf as any).source ?? 'unknown'}`]);
          setOcrRetrySucceeded(true);

          if (backendPdf.parsed) {
            setOcrLogs((prev) => [...prev, 'AI: dane sparsowane przez Gemini']);
            setLastOcrRawText(backendPdf.parsed.formattedText || backendPdf.text || '');
            setOcrProgress(100);
            buildProposal({ ...backendPdf.parsed, rawText: backendPdf.text });
          } else {
            setOcrLogs((prev) => [...prev, 'AI: niedostępne, lokalne parsowanie tekstu']);
            const parsed = parseReceiptText(backendPdf.text);
            setLastOcrRawText(parsed.rawText || backendPdf.text || '');
            setOcrProgress(100);
            buildProposal({ ...parsed });
          }

          setOcrLogs((prev) => [...prev, 'Parsowanie tekstu PDF zakończone.']);
          return;
        }

        setOcrLogs((prev) => [...prev, 'PDF: backend nie odczytał tekstu, przejście do OCR']);
      }

      const parsed = await runReceiptOcr(sourceFile, {
        onProgress: (progress) => setOcrProgress(progress),
        onStage: (message) => setOcrLogs((prev) => [...prev, message]),
      });

      setOcrRetrySucceeded(true);

      setLastOcrRawText(parsed.rawText || '');
      setOcrLogs((prev) => [...prev, 'OCR zakończony.']);

      // Try AI parsing for better results
      if (parsed.rawText && parsed.rawText.length >= 20) {
        try {
          setOcrLogs((prev) => [...prev, 'AI: wysyłanie tekstu do interpretacji...']);
          const aiResult = await api.parseReceiptAI(parsed.rawText);
          if (aiResult.parsed) {
            setOcrLogs((prev) => [...prev, 'AI: dane sparsowane pomyślnie']);
            setLastOcrRawText(aiResult.parsed.formattedText || parsed.rawText);
            buildProposal({ ...aiResult.parsed, rawText: parsed.rawText });
            return;
          }
          setOcrLogs((prev) => [...prev, 'AI: brak odpowiedzi, lokalne parsowanie']);
        } catch {
          setOcrLogs((prev) => [...prev, 'AI: błąd, lokalne parsowanie']);
        }
      }

      buildProposal({ ...parsed });
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : 'nieznany błąd';
      setOcrLogs((prev) => [...prev, `Błąd OCR: ${errMsg}`]);
      setOcrRetrySucceeded(false);
      toastError('Ponowny OCR nie powiódł się.');
    } finally {
      setOcrRunning(false);
    }
  };

  const applyProposal = () => {
    if (!ocrProposal) return;
    if (proposalAccepted.description && ocrProposal.description) setDescription(ocrProposal.description);
    if (proposalAccepted.amount && ocrProposal.amount) setAmount(String(ocrProposal.amount));
    if (proposalAccepted.date && ocrProposal.date) setDate(ocrProposal.date);
    if (proposalAccepted.items && ocrProposal.items) setItems(ocrProposal.items);
    if (proposalAccepted.notes && ocrProposal.notes) {
      setNotes((prev) => {
        const base = (prev || '').trim();
        const snippet = ocrProposal.notes!.trim();
        if (!snippet) return prev;
        if (base.includes(snippet.slice(0, 100))) return prev;
        return base ? `${base}\n\nOCR:\n${snippet}` : `OCR:\n${snippet}`;
      });
    }
    setOcrProposal(null);
    setProposalAccepted({});
    setShowOcrDetails(false);
    toastSuccess('Dane z OCR zostały zastosowane.');
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
  const showSplitPreview = !!receipt && !!imageUrl;

  const configurableReceiptFields = useMemo(() => {
    if (!receiptConfig) return [];
    return receiptConfig.availableFields.filter((field) => {
      const cfg = receiptConfig.fieldConfigs[field.id];
      return cfg?.mode === 'receipt_configurable';
    });
  }, [receiptConfig]);

  const updateTemplateFieldValue = (fieldId: string, value: unknown) => {
    setTemplateFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const isEmptyFieldValue = (field: ReceiptConfigState['availableFields'][number], value: unknown) => {
    if (value == null) return true;
    if (field.type === 'checkbox') return value !== true;
    if (Array.isArray(value)) return value.length === 0;
    if (field.type === 'currency' && typeof value === 'object') {
      const amountValue = Number((value as any).amount ?? 0);
      return !Number.isFinite(amountValue) || amountValue <= 0;
    }
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  };

  const renderConfigurableFieldInput = (field: ReceiptConfigState['availableFields'][number]) => {
    const value = templateFieldValues[field.id];

    if (field.type === 'tag_group') {
      const selectedNames = Array.isArray(value) ? (value as string[]) : [];
      const groupTags = tags.filter((tag) => !field.tagGroupId || tag.groupId === field.tagGroupId);
      const allowMultiple = field.allowMultiple !== false;

      return (
        <div className="space-y-2">
          <div className="flex w-full flex-wrap gap-2">
            {groupTags.map((tag) => {
              const selected = selectedNames.includes(tag.name);
              return (
                <div
                  key={`${field.id}-${tag.id}`}
                  className={`cursor-pointer`}
                  onClick={() => {
                    const next = selected
                      ? selectedNames.filter((name) => name !== tag.name)
                      : (allowMultiple ? [...selectedNames, tag.name] : [tag.name]);
                    updateTemplateFieldValue(field.id, next);
                  }}
                >
                  <Tag name={tag.name} icon={tag.icon}color={tag.color} groupName={tag.groupName} selected={selected} />
                </div>
              );
            })}
          </div>
          {groupTags.length === 0 && <p className="text-xs text-muted-foreground">Brak tagów w przypisanej grupie.</p>}
        </div>
      );
    }

    if (field.type === 'person') {
      return (
        <Select value={typeof value === 'string' ? value : '__none'} onValueChange={(next) => updateTemplateFieldValue(field.id, next === '__none' ? '' : next)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Wybierz osobę" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Brak</SelectItem>
            {members.map((member: any) => (
              <SelectItem key={`${field.id}-${member.id}`} value={String(member.name ?? member.id)}>{member.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <div className="flex items-center gap-2 rounded-md border p-2">
          <Checkbox checked={value === true} onCheckedChange={(checked) => updateTemplateFieldValue(field.id, checked === true)} />
          <span className="text-sm">Tak / Nie</span>
        </div>
      );
    }

    if (field.type === 'date') {
      return (
        <Input type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => updateTemplateFieldValue(field.id, e.target.value)} />
      );
    }

    if (field.type === 'select') {
      const options = Array.isArray(field.options) ? field.options : [];
      return (
        <Select value={typeof value === 'string' ? value : '__none'} onValueChange={(next) => updateTemplateFieldValue(field.id, next === '__none' ? '' : next)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Wybierz opcję" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Brak</SelectItem>
            {options.map((option) => <SelectItem key={`${field.id}-${option}`} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'currency') {
      const amountValue = typeof value === 'object' && value != null ? String((value as any).amount ?? '') : '';
      const currencyValue = typeof value === 'object' && value != null ? String((value as any).currency ?? (field.currencyOptions?.[0] ?? 'PLN')) : (field.currencyOptions?.[0] ?? 'PLN');
      const currencyOptions = Array.isArray(field.currencyOptions) && field.currencyOptions.length > 0 ? field.currencyOptions : ['PLN'];

      return (
        <div className="grid grid-cols-3 gap-2">
          <Input
            className="col-span-2"
            type="number"
            step="0.01"
            value={amountValue}
            onChange={(e) => updateTemplateFieldValue(field.id, { amount: Number(e.target.value || 0), currency: currencyValue })}
          />
          <Select value={currencyValue} onValueChange={(next) => updateTemplateFieldValue(field.id, { amount: Number(amountValue || 0), currency: next })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencyOptions.map((currency) => <SelectItem key={`${field.id}-${currency}`} value={currency}>{currency}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <Input
        type={field.type === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(e) => updateTemplateFieldValue(field.id, field.type === 'number' ? Number(e.target.value || 0) : e.target.value)}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${receipt ? 'w-[95vw] sm:w-[80vw] sm:max-w-[80vw]' : 'max-w-2xl sm:max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
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
          <>
          <div className={showSplitPreview ? 'lg:grid lg:grid-cols-2 lg:gap-4' : ''}>
            <div className={`space-y-4 ${showSplitPreview ? 'lg:col-span-1' : ''}`}>
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

            {/* Store, Person */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sklep</Label>
                <Select className='w-full' value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger disabled={stores.length == 0} className='w-full'><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Osoba</Label>
                <Select className='w-full' value={personId} onValueChange={setPersonId}>
                  <SelectTrigger className='w-full'><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    {members.map((m: any) => (
                      <SelectItem key={m.user.id} value={m.user.id}>{m.user.firstName} {m.user.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notatki</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="max-h-100 overflow-y-auto" />
            </div>

            {configurableReceiptFields.length > 0 && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-semibold">Pola wymagane przez szablon wydatku</p>
                <div className="">
                  {configurableReceiptFields.map((field) => {
                    const required = !!receiptConfig?.fieldConfigs[field.id]?.required;
                    const isMissing = required && isEmptyFieldValue(field, templateFieldValues[field.id]);
                    return (
                      <div key={field.id} className="space-y-1">
                        <Label className={isMissing ? 'text-red-600' : ''}>
                          {field.name} {required ? '*' : ''}
                        </Label>
                        {renderConfigurableFieldInput(field)}
                        {isMissing && <p className="text-xs text-red-600">To pole jest wymagane przed zatwierdzeniem.</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}



            {/* Image */}
            {imageUrl && (
              <div className="space-y-2 lg:hidden">
                <div className="flex items-center justify-between">
                  <Label>Podgląd paragonu</Label>
                  <div className="flex items-center gap-1">
                    {ocrProposal && (
                      <Button type="button" variant="default" size="sm" onClick={() => setShowOcrDetails(true)}>
                        Pokaż propozycję OCR
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => void runOcrAgain()} disabled={ocrRunning}>
                      {ocrRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Ponowny OCR
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setImageUrl('')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="lg:hidden">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowMobilePreview((v) => !v)}>
                    {showMobilePreview ? 'Ukryj podgląd' : 'Pokaż podgląd'}
                  </Button>
                  {showMobilePreview && (
                    <div className="mt-2 rounded-lg border p-2">
                      {isPdfDataUrl(imageUrl) ? (
                        <iframe src={imageUrl} title="Paragon PDF" className="h-90 w-full rounded" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="Paragon" className="max-h-80 w-full rounded-lg object-contain" />
                      )}
                    </div>
                  )}
                </div>
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

            </div>

            {showSplitPreview && (
              <div className="hidden lg:col-span-1 lg:block">
                <div className="sticky top-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Podgląd paragonu</Label>
                    <div className="flex items-center gap-1">
                      {ocrProposal && (
                        <Button type="button" variant="default" size="sm" onClick={() => setShowOcrDetails(true)}>
                          Pokaż propozycję OCR
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => void runOcrAgain()} disabled={ocrRunning}>
                        {ocrRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Ponowny OCR
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border p-2">
                    {isPdfDataUrl(imageUrl) ? (
                      <iframe src={imageUrl} title="Paragon PDF" className="h-[70vh] w-full rounded" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="Paragon" className="max-h-[70vh] w-full rounded-lg object-contain" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving || !description || !amount}>
              {saving ? 'Zapisywanie...' : (receipt ? 'Zapisz' : 'Dodaj')}
            </Button>
          </DialogFooter>
          </>
        )}
      </DialogContent>

      <Dialog open={showOcrDetails} onOpenChange={setShowOcrDetails}>
        <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Szczegóły procesu OCR</DialogTitle>
            <DialogDescription>Podgląd postępu i logów ponownego OCR dla tego paragonu.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Postęp</span>
                <span>{ocrProgress}%</span>
              </div>
              <Progress value={ocrProgress} />
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Log procesu</p>
              <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {ocrLogs.length === 0 ? (
                  <p className="text-muted-foreground">Brak logów.</p>
                ) : ocrLogs.map((line, idx) => <p key={`${line}-${idx}`}>- {line}</p>)}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Surowy tekst OCR (fragment)</p>
              <Textarea readOnly value={lastOcrRawText.slice(0, 2000)} rows={6} className="max-h-62.5 overflow-y-auto" />
            </div>

            {/* ── OCR Proposal Comparison ── */}
            {ocrProposal && !ocrRunning && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 p-3 space-y-3">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Propozycja danych z OCR</p>
                <p className="text-xs text-muted-foreground">Zaznacz pola, które chcesz zaktualizować, a następnie kliknij &quot;Zastosuj wybrane&quot;.</p>

                <div className="space-y-2">
                  {ocrProposal.description && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!proposalAccepted.description} onChange={(e) => setProposalAccepted((p) => ({ ...p, description: e.target.checked }))} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">Opis</span>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="rounded bg-muted/50 px-2 py-1 text-xs"><span className="text-muted-foreground">Obecny: </span>{description || '(brak)'}</div>
                          <div className="rounded bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs text-green-800 dark:text-green-300"><span className="text-muted-foreground">Nowy: </span>{ocrProposal.description}</div>
                        </div>
                      </div>
                    </label>
                  )}

                  {ocrProposal.amount != null && ocrProposal.amount > 0 && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!proposalAccepted.amount} onChange={(e) => setProposalAccepted((p) => ({ ...p, amount: e.target.checked }))} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">Kwota (PLN)</span>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="rounded bg-muted/50 px-2 py-1 text-xs"><span className="text-muted-foreground">Obecna: </span>{amount || '0'} PLN</div>
                          <div className="rounded bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs text-green-800 dark:text-green-300"><span className="text-muted-foreground">Nowa: </span>{ocrProposal.amount} PLN</div>
                        </div>
                      </div>
                    </label>
                  )}

                  {ocrProposal.date && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!proposalAccepted.date} onChange={(e) => setProposalAccepted((p) => ({ ...p, date: e.target.checked }))} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">Data</span>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="rounded bg-muted/50 px-2 py-1 text-xs"><span className="text-muted-foreground">Obecna: </span>{date}</div>
                          <div className="rounded bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs text-green-800 dark:text-green-300"><span className="text-muted-foreground">Nowa: </span>{ocrProposal.date}</div>
                        </div>
                      </div>
                    </label>
                  )}

                  {ocrProposal.items && ocrProposal.items.length > 0 && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!proposalAccepted.items} onChange={(e) => setProposalAccepted((p) => ({ ...p, items: e.target.checked }))} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">Pozycje paragonu ({ocrProposal.items.length})</span>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="rounded bg-muted/50 px-2 py-1 text-xs">
                            <span className="text-muted-foreground">Obecne: </span>
                            {items.length === 0 ? '(brak)' : `${items.length} poz.`}
                            {items.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {items.slice(0, 5).map((it, i) => (
                                  <li key={i} className="truncate">{it.name} — {it.total.toFixed(2)} PLN</li>
                                ))}
                                {items.length > 5 && <li className="text-muted-foreground">...i {items.length - 5} więcej</li>}
                              </ul>
                            )}
                          </div>
                          <div className="rounded bg-green-50 dark:bg-green-900/30 px-2 py-1 text-xs text-green-800 dark:text-green-300">
                            <span className="text-muted-foreground">Nowe: </span>{ocrProposal.items.length} poz.
                            <ul className="mt-1 space-y-0.5">
                              {ocrProposal.items.slice(0, 5).map((it, i) => (
                                <li key={i} className="truncate">{it.name} × {it.quantity} — {it.total.toFixed(2)} PLN</li>
                              ))}
                              {ocrProposal.items.length > 5 && <li className="text-muted-foreground">...i {ocrProposal.items.length - 5} więcej</li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </label>
                  )}

                  {ocrProposal.notes && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={!!proposalAccepted.notes} onChange={(e) => setProposalAccepted((p) => ({ ...p, notes: e.target.checked }))} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium">Notatki (tekst OCR)</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Dopisze tekst OCR do notatek</p>
                      </div>
                    </label>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setOcrProposal(null); setProposalAccepted({}); }}>
                    Odrzuć wszystko
                  </Button>
                  <Button size="sm" onClick={applyProposal} disabled={!Object.values(proposalAccepted).some(Boolean)}>
                    Zastosuj wybrane
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOcrDetails(false)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ─── Receipt Card (Grid View) ───────────────────────
function ReceiptCard({ receipt, categories, onEdit, onDelete, onDuplicate, onCreateExpense, canApprove }: {
  receipt: IReceipt;
  categories: Category[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCreateExpense: () => void;
  canApprove: boolean;
}) {
  const cat = categories.find(c => c.id === receipt.categoryId);
  const status = receiptStatusLabel(receipt);

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
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{receipt.items.length} pozycji</p>
            <p className="line-clamp-2">
              {receipt.items.slice(0, 3).map((item) => item.name).join(', ')}
            </p>
          </div>
        )}

        {receipt.tags && receipt.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {receipt.tags.map((tag) => (
              <Tag key={tag.id} name={tag.name} color={tag.color} icon={tag.icon} groupName={tag.groupName} />
            ))}
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
      <DialogContent className="max-w-3xl sm:max-w-3xl">
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
  const header = 'Data;Opis;Kwota;Sklep;Notatki\n';
  const rows = receipts.map(r =>
    `${formatDate(r.date)};${r.description};${r.amount};${r.storeId ?? ''};${r.notes ?? ''}`
  ).join('\n');

  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paragony_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReceiptSettingsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ReceiptConfigState;
  availableTags: TagOption[];
  onSave: (payload: any) => Promise<void>;
  saving: boolean;
}) {
  const { open, onOpenChange, config, availableTags, onSave, saving } = props;
  const [localFieldConfigs, setLocalFieldConfigs] = useState<Record<string, ReceiptFieldConfig>>(config.fieldConfigs ?? {});

  const fieldTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      text: 'Tekst',
      textarea: 'Dłuższy tekst',
      number: 'Liczba',
      currency: 'Waluta',
      date: 'Data',
      checkbox: 'Tak/Nie',
      select: 'Lista wyboru',
      person: 'Osoba',
      tag_group: 'Grupa tagów',
    };
    return labels[type] ?? type;
  };

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setLocalFieldConfigs(config.fieldConfigs);
    });
  }, [open, config.fieldConfigs]);

  const sourceFields = config.receiptFields?.length > 0 ? config.receiptFields : DEFAULT_RECEIPT_SOURCE_FIELDS;

  const ensureConfig = (fieldId: string): ReceiptFieldConfig => {
    return localFieldConfigs[fieldId] ?? { mode: 'none', receiptFieldId: null, autoTagIds: [], required: false };
  };

  const updateFieldConfig = (fieldId: string, patch: Partial<ReceiptFieldConfig>) => {
    setLocalFieldConfigs((prev) => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] ?? { mode: 'none', receiptFieldId: null, autoTagIds: [], required: false }),
        ...patch,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-8xl sm:max-w-8xl h-[80vh] flex-col">
        <DialogHeader>
          <DialogTitle>Ustawienia Paragonów</DialogTitle>
          <DialogDescription>
            Skonfiguruj mapowanie każdego pola szablonu i oznacz pola wymagane do zatwierdzenia paragonu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 h-auto overflow-auto">
            {config.availableFields.map((field) => {
              const cfg = ensureConfig(field.id);
              const selectedTagIds = Array.isArray(cfg.autoTagIds) ? cfg.autoTagIds : [];
              const allowAutoTags = field.type === 'tag_group';

              return (
                <div key={field.id} className="rounded-md border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">Typ: {fieldTypeLabel(field.type)}</p>
                  </div>

                  <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <Select
                      value={cfg.mode}
                      onValueChange={(value) => {
                        const nextMode = value as ReceiptFieldMode;
                        updateFieldConfig(field.id, {
                          mode: nextMode,
                          receiptFieldId: nextMode === 'map' ? (cfg.receiptFieldId ?? null) : null,
                          autoTagIds: nextMode === 'auto_tags' ? selectedTagIds : [],
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-full lg:w-75">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nie mapuj</SelectItem>
                        <SelectItem value="map">Mapowanie z pola paragonu</SelectItem>
                        <SelectItem value="receipt_configurable">Pole do konfiguracji w paragonie</SelectItem>
                        {allowAutoTags && <SelectItem value="auto_tags">Automatyczne tagi</SelectItem>}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                      <Checkbox
                        checked={!!cfg.required}
                        onCheckedChange={(checked) => updateFieldConfig(field.id, { required: checked === true })}
                      />
                      Wymagane
                    </label>
                  </div>

                  {field.required ? (
                    <p className="mb-2 text-xs text-muted-foreground">Pole wymagane w szablonie wydatku.</p>
                  ) : null}

                  {cfg.mode === 'map' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Źródło z paragonu</Label>
                      <Select
                        value={cfg.receiptFieldId ?? '__none'}
                        onValueChange={(value) => updateFieldConfig(field.id, { receiptFieldId: value === '__none' ? null : value as ReceiptSourceFieldId })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Wybierz pole paragonu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Brak</SelectItem>
                          {sourceFields.map((source) => (
                            <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {cfg.mode === 'auto_tags' && allowAutoTags && (
                    <div className="space-y-2">
                      <Label className="text-xs">Tagi ustawiane automatycznie</Label>
                      {availableTags.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Brak dostępnych tagów w rodzinie.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableTags
                            .filter((tag) => !field.tagGroupId || tag.groupId === field.tagGroupId)
                            .map((tag) => {
                            const selected = selectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                className="rounded-md transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-pressed={selected}
                                onClick={() => {
                                  const next = selected
                                    ? selectedTagIds.filter((id) => id !== tag.id)
                                    : [...selectedTagIds, tag.id];
                                  updateFieldConfig(field.id, { autoTagIds: next });
                                }}
                              >
                                <Tag
                                  name={tag.name}
                                  icon={tag.icon}
                                  color={tag.color}
                                  groupName={tag.groupName}
                                  selected={selected}
                                  className={selected ? '' : 'opacity-70 hover:opacity-100'}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {config.availableFields.length === 0 && (
              <p className="text-sm text-muted-foreground">Brak pól w bieżącym szablonie wydatków.</p>
            )}
          </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button disabled={saving} onClick={() => void onSave({ fieldConfigs: localFieldConfigs })}>
            {saving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────
export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<IReceipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<IReceiptStats | null>(null);
  const [receiptConfig, setReceiptConfig] = useState<{
    expenseMapping: ReceiptExpenseMappingConfig;
    availableFields: ReceiptConfigState['availableFields'];
    receiptFields: Array<{ id: ReceiptSourceFieldId; name: string }>;
    fieldConfigs: Record<string, ReceiptFieldConfig>;
  } | null>(null);
  const [billingPeriodDateRange, setBillingPeriodDateRange] = useState<{ from: string; to: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
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
      let effectiveFrom = filterFrom || undefined;
      let effectiveTo = filterTo || undefined;
      let resolvedBillingPeriodRange: { from: string; to: string } | null = null;

      if (!filterFrom && !filterTo) {
        try {
          const defaultTemplate = await api.getDefaultTemplate();
          if (defaultTemplate?.id && defaultTemplate.billingPeriod?.type) {
            const billingPeriod = await api.getBillingPeriod(defaultTemplate.id);
            if (billingPeriod?.periodStart && billingPeriod?.periodEnd) {
              const from = String(billingPeriod.periodStart).split('T')[0];
              const exclusiveEnd = String(billingPeriod.periodEnd).split('T')[0];
              const to = shiftDateByDays(exclusiveEnd, -1);
              resolvedBillingPeriodRange = { from, to };
              effectiveFrom = from;
              effectiveTo = to;
            }
          }
        } catch (error) {
          console.error('Failed to resolve receipt billing period:', error);
        }
      }

      const [receiptsData, categoriesData, storesData, membersData, statsData, tagGroupsData, receiptConfigData] = await Promise.all([
        api.getReceipts({ from: effectiveFrom, to: effectiveTo, storeId: filterStore || undefined, search: search || undefined }),
        api.getCategories(),
        api.getStores(),
        api.getFamilyMembers().catch(() => []),
        api.getReceiptStats(effectiveFrom, effectiveTo),
        api.getTagGroups().catch(() => []),
        api.getReceiptConfig().catch(() => null),
      ]);
      setBillingPeriodDateRange(resolvedBillingPeriodRange);
      setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData as Category[] : []);
      setStores(Array.isArray(storesData) ? storesData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setStats(statsData);
      const tagOptions = Array.isArray(tagGroupsData)
        ? tagGroupsData.flatMap((group: any) => Array.isArray(group?.tags)
          ? group.tags.map((tag: any) => ({
              id: String(tag.id),
              name: String(tag.name),
              color: tag.color ?? null,
              icon: tag.icon ?? null,
              groupName: group.name ?? null,
              groupId: group.id ?? null,
            }))
          : [])
        : [];
      setTags(tagOptions);
      const validReceiptConfig =
        receiptConfigData
        && typeof receiptConfigData === 'object'
        && Array.isArray((receiptConfigData as any).availableFields)
        && typeof (receiptConfigData as any).expenseMapping === 'object'
        && typeof (receiptConfigData as any).fieldConfigs === 'object'
          ? {
              expenseMapping: (receiptConfigData as any).expenseMapping as ReceiptExpenseMappingConfig,
              availableFields: (receiptConfigData as any).availableFields as ReceiptConfigState['availableFields'],
              receiptFields: Array.isArray((receiptConfigData as any).receiptFields)
                ? (receiptConfigData as any).receiptFields as Array<{ id: ReceiptSourceFieldId; name: string }>
                : DEFAULT_RECEIPT_SOURCE_FIELDS,
              fieldConfigs: (receiptConfigData as any).fieldConfigs as Record<string, ReceiptFieldConfig>,
            }
          : null;
      setReceiptConfig(validReceiptConfig);
    } catch { setReceipts([]); }
    finally { setLoading(false); }
  }, [filterFrom, filterTo, filterStore, search]);

  const handleSaveSettings = useCallback(async (payload: any) => {
    setSavingSettings(true);
    try {
      const updated = await api.updateReceiptConfig(payload);
      const validUpdated =
        updated
        && typeof updated === 'object'
        && Array.isArray((updated as any).availableFields)
        && typeof (updated as any).expenseMapping === 'object'
        && typeof (updated as any).fieldConfigs === 'object'
          ? {
              expenseMapping: (updated as any).expenseMapping as ReceiptExpenseMappingConfig,
              availableFields: (updated as any).availableFields as ReceiptConfigState['availableFields'],
              receiptFields: Array.isArray((updated as any).receiptFields)
                ? (updated as any).receiptFields as Array<{ id: ReceiptSourceFieldId; name: string }>
                : DEFAULT_RECEIPT_SOURCE_FIELDS,
              fieldConfigs: (updated as any).fieldConfigs as any,
            }
          : null;
      setReceiptConfig(validUpdated);
      setShowSettings(false);
    } finally {
      setSavingSettings(false);
    }
  }, []);

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
    try {
      await api.createExpenseFromReceipt(id);
    } catch (e: any) {
      console.error(e);
      toastError(e?.message || 'Nie udało się zatwierdzić paragonu.');
      return;
    }
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



  const hasMissingRequiredFieldsForApproval = useCallback((receipt: IReceipt) => {
    if (!receiptConfig) return false;
    const values = (((receipt as any).configurableFields as Record<string, unknown>) ?? {});
    const requiredFields = receiptConfig.availableFields.filter((field) => {
      const cfg = receiptConfig.fieldConfigs[field.id];
      return cfg?.mode === 'receipt_configurable' && cfg.required;
    });

    return requiredFields.some((field) => {
      const value = values[field.id];
      if (value == null) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (field.type === 'checkbox') return value !== true;
      if (field.type === 'currency' && typeof value === 'object') {
        const amountValue = Number((value as any).amount ?? 0);
        return !Number.isFinite(amountValue) || amountValue <= 0;
      }
      if (typeof value === 'string') return value.trim().length === 0;
      return false;
    });
  }, [receiptConfig]);

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
          {billingPeriodDateRange && !filterFrom && !filterTo && (
            <p className="text-sm text-muted-foreground">
              Domyślnie pokazany jest bieżący okres rozliczeniowy: {formatDate(billingPeriodDateRange.from)} - {formatDate(billingPeriodDateRange.to)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-1" /> Ustawienia
          </Button>
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
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Brak paragonów</TableCell>
                  </TableRow>
                ) : sortedReceipts.map((r) => {
                  const status = receiptStatusLabel(r);
                  const canApprove = r.ocrStatus !== 'PENDING' && !r.isApproved && !hasMissingRequiredFieldsForApproval(r);
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
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPLN(r.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.items && r.items.length > 0
                          ? `${r.items.length} poz. ${r.items.slice(0, 2).map((item) => item.name).join(', ')}`
                          : '—'}
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
              canApprove={r.ocrStatus !== 'PENDING' && !r.isApproved && !hasMissingRequiredFieldsForApproval(r)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <ReceiptFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditReceipt(null); }}
        receipt={editReceipt}
        stores={stores}
        tags={tags}
        members={members}
        receiptConfig={receiptConfig as ReceiptConfigState | null}
        onSaved={loadData}
      />

      {receiptConfig && (
        <ReceiptSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          config={receiptConfig as ReceiptConfigState}
          availableTags={tags}
          onSave={handleSaveSettings}
          saving={savingSettings}
        />
      )}

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
