'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Camera, Plus, ArrowLeft, ShoppingCart, Loader2, CheckCircle2, ImagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import { compressImage, fileToDataUrl, runReceiptOcr } from '@/lib/receipt-ocr';

type Step = 'categories' | 'form' | 'saving' | 'done';

interface AddExpenseDialogProps {
  onExpenseAdded?: () => void;
}

interface ITagOption {
  id: string;
  name: string;
  color: string;
  tagGroupId: string;
  tagGroupName: string;
}

interface ITemplateColumn {
  id: string;
  name?: string;
  type?: string;
  tagGroupId?: string;
}

export function AddExpenseDialog({ onExpenseAdded }: AddExpenseDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('categories');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateColumns, setTemplateColumns] = useState<ITemplateColumn[]>([]);
  const [tagMappings, setTagMappings] = useState<{ income?: string; expense?: string; planning?: string; costs?: string; savings?: string }>({});
  const [tagIdToName, setTagIdToName] = useState<Record<string, string>>({});
  const [tagIdToGroupId, setTagIdToGroupId] = useState<Record<string, string>>({});
  const [configuredFieldId, setConfiguredFieldId] = useState<string | null>(null);
  const [configuredFieldName, setConfiguredFieldName] = useState<string>('');
  const [configuredGroupName, setConfiguredGroupName] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<ITagOption[]>([]);
  const [selectedTag, setSelectedTag] = useState<ITagOption | null>(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('categories');
    setSelectedTag(null);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
  }, []);

  useEffect(() => {
    if (!open) return;

    setTimeout(resetState, 0);
    (async () => {
      try {
        const [tmpl, mappings, groups, dashboardConfig] = await Promise.all([
          api.getDefaultTemplate(),
          api.getTagMappings().catch(() => ({})),
          api.getTagGroups().catch(() => []),
          api.getDashboardConfig().catch(() => ({ categoryFieldId: null, availableCategoryFields: [] })),
        ]);

        const nextTemplateColumns = Array.isArray(tmpl.columns) ? (tmpl.columns as ITemplateColumn[]) : [];
        setTemplateId(tmpl.id);
        setTemplateColumns(nextTemplateColumns);
        setTagMappings(mappings ?? {});

        const idToName: Record<string, string> = {};
        const idToGroupId: Record<string, string> = {};
        const tags: ITagOption[] = [];
        for (const group of (Array.isArray(groups) ? groups : [])) {
          for (const tag of group.tags ?? []) {
            idToName[tag.id] = tag.name;
            idToGroupId[tag.id] = group.id;
            tags.push({
              id: tag.id,
              name: tag.name,
              color: tag.color || '#2ECC71',
              tagGroupId: group.id,
              tagGroupName: group.name,
            });
          }
        }
        setTagIdToName(idToName);
        setTagIdToGroupId(idToGroupId);

        const chosenFieldId = typeof dashboardConfig?.categoryFieldId === 'string' ? dashboardConfig.categoryFieldId : null;
        const chosenColumn = nextTemplateColumns.find((c) => c.id === chosenFieldId && c.type === 'tag_group');
        if (!chosenColumn) {
          setConfiguredFieldId(null);
          setConfiguredFieldName('');
          setConfiguredGroupName('');
          setCategoryOptions([]);
          return;
        }

        setConfiguredFieldId(chosenColumn.id);
        setConfiguredFieldName(chosenColumn.name || chosenColumn.id);

        const groupName = tags.find((t) => t.tagGroupId === chosenColumn.tagGroupId)?.tagGroupName || '';
        setConfiguredGroupName(groupName);

        const options = tags.filter((t) => t.tagGroupId === chosenColumn.tagGroupId);
        setCategoryOptions(options);
      } catch (e) {
        console.error('Failed to load data for expense dialog:', e);
        toastError('Nie udało się załadować danych formularza wydatku.');
      }
    })();
  }, [open, resetState]);

  const canSaveManual = useMemo(() => {
    if (!selectedTag) return false;
    const parsedAmount = Number(amount.replace(',', '.'));
    return Number.isFinite(parsedAmount) && parsedAmount > 0;
  }, [selectedTag, amount]);

  const appendTagToField = (recordData: Record<string, unknown>, fieldId: string, tagName: string) => {
    const current = Array.isArray(recordData[fieldId]) ? (recordData[fieldId] as string[]) : [];
    if (!current.includes(tagName)) {
      recordData[fieldId] = [...current, tagName];
    }
  };

  const applyExpenseMappingTag = (recordData: Record<string, unknown>) => {
    if (!tagMappings.expense) return;
    const mappingTagName = tagIdToName[tagMappings.expense];
    const mappingTagGroupId = tagIdToGroupId[tagMappings.expense];
    if (!mappingTagName || !mappingTagGroupId) return;

    const targetCol = templateColumns.find((c) => c.type === 'tag_group' && c.tagGroupId === mappingTagGroupId);
    if (!targetCol) return;

    appendTagToField(recordData, targetCol.id, mappingTagName);
  };

  const saveExpense = useCallback(async () => {
    if (!templateId || !configuredFieldId || !selectedTag) return;

    const parsedAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    setStep('saving');

    try {
      const recordData: Record<string, unknown> = {
        col_date: date,
        col_amount: { amount: parsedAmount, currency: 'PLN' },
        col_paid: true,
      };

      appendTagToField(recordData, configuredFieldId, selectedTag.name);
      applyExpenseMappingTag(recordData);

      const textCol = templateColumns.find((c) => c.type === 'text' && /name|nazwa|description|opis/i.test(`${c.id} ${c.name ?? ''}`));
      if (textCol) {
        recordData[textCol.id] = description || selectedTag.name;
      } else {
        recordData.col_name = description || selectedTag.name;
      }

      const personCol = templateColumns.find((c) => c.type === 'person');
      if (personCol) {
        recordData[personCol.id] = user?.firstName ?? user?.username ?? '';
      }

      await api.createRecord(templateId, recordData);
      window.dispatchEvent(new Event('financio:summary-refresh'));
      setStep('done');
      onExpenseAdded?.();
      setTimeout(() => setOpen(false), 1100);
    } catch (e) {
      console.error('Failed to save expense:', e);
      toastError('Nie udało się zapisać wydatku. Spróbuj ponownie.');
      setStep('form');
    }
  }, [templateId, configuredFieldId, selectedTag, amount, date, description, templateColumns, user, onExpenseAdded, tagMappings, tagIdToName, tagIdToGroupId]);

  const runBackgroundReceiptFlow = useCallback(async (file: File) => {
    const today = new Date().toISOString().split('T')[0];
    const fallbackDescription = file.name?.replace(/\.[^.]+$/, '') || 'Paragon';
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    try {
      const rawDataUrl = await fileToDataUrl(file);
      const filePayload = isPdf ? rawDataUrl : await compressImage(rawDataUrl);

      const receipt = await api.createReceipt({
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
        toastSuccess('Paragon PDF dodany. Uzupełnij dane ręcznie na liście paragonów.');
      } else {
        toastSuccess('Paragon dodany. Trwa przetwarzanie OCR w tle.');
      }

      if (isPdf) {
        onExpenseAdded?.();
        return;
      }

      try {
        const parsed = await runReceiptOcr(file);
        const hasUsefulData = parsed.total > 0 || parsed.items.length > 0 || !!parsed.storeName;

        if (!hasUsefulData) {
          await api.updateReceipt(receipt.id, {
            ocrStatus: 'FAILED',
            ocrError: 'Nie udało się odczytać danych z OCR.',
            notes: parsed.rawText?.slice(0, 2000) || undefined,
          }, { notifySuccess: false, suppressErrorToast: true });
        } else {
          await api.updateReceipt(receipt.id, {
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
        await api.updateReceipt(receipt.id, {
          ocrStatus: 'FAILED',
          ocrError: 'Błąd podczas OCR. Uzupełnij dane ręcznie.',
        }, { notifySuccess: false, suppressErrorToast: true });
      }

      window.dispatchEvent(new Event('financio:summary-refresh'));
      window.dispatchEvent(new Event('financio:receipts-refresh'));
      onExpenseAdded?.();
    } catch (e) {
      console.error('Failed to start background receipt flow:', e);
      toastError('Nie udało się dodać paragonu do przetwarzania.');
    }
  }, [onExpenseAdded]);

  const handlePickReceipt = async (file?: File | null) => {
    if (!file) return;
    setOpen(false);
    await runBackgroundReceiptFlow(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nowy wydatek</span>
          <span className="sm:hidden">Wydatek</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== 'categories' && step !== 'saving' && step !== 'done' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={() => resetState()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'categories' && 'Nowy wydatek'}
            {step === 'form' && (selectedTag?.name || 'Szczegóły wydatku')}
            {step === 'saving' && 'Zapisywanie...'}
            {step === 'done' && 'Gotowe!'}
          </DialogTitle>
        </DialogHeader>

        {step === 'categories' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Paragon (priorytet)</p>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-11 gap-2" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                  Aparat
                </Button>
                <Button variant="outline" className="h-11 gap-2" onClick={() => galleryInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  Galeria
                </Button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePickReceipt(e.target.files?.[0])}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => handlePickReceipt(e.target.files?.[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Kategoria (tag)</p>
                {configuredFieldName && (
                  <span className="text-[11px] text-muted-foreground">
                    {configuredFieldName}{configuredGroupName ? ` • ${configuredGroupName}` : ''}
                  </span>
                )}
              </div>

              {!configuredFieldId && (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Wybierz Pole Kategorii w ustawieniach dashboardu (ikona zębatki), aby dodać wydatek przez tag.
                </div>
              )}

              {configuredFieldId && categoryOptions.length === 0 && (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Wybrane pole kategorii nie ma jeszcze tagów do wyboru.
                </div>
              )}

              {categoryOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setSelectedTag(tag);
                        setDescription(tag.name);
                        setStep('form');
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        'hover:bg-accent/60',
                      )}
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'form' && selectedTag && (
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveExpense();
            }}
          >
            <div>
              <Label>Wybrany tag</Label>
              <div className="mt-1">
                <Badge variant="outline" style={{ borderColor: selectedTag.color, color: selectedTag.color }}>
                  {selectedTag.name}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-amount">Kwota (PLN)</Label>
              <Input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="text-lg h-12 font-semibold"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-date">Data</Label>
              <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-desc">Opis (opcjonalnie)</Label>
              <Input
                id="expense-desc"
                type="text"
                placeholder="np. Zakupy"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-11 gap-2" disabled={!canSaveManual}>
              <ShoppingCart className="h-4 w-4" />
              Dodaj wydatek
            </Button>
          </form>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Zapisywanie wydatku...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold text-foreground">Wydatek zapisany!</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
