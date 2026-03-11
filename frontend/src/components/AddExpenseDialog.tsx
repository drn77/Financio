'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  Camera,
  Plus,
  ArrowLeft,
  ShoppingCart,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ReceiptScanner, type ParsedReceipt } from '@/components/ReceiptScanner';
import { cn } from '@/lib/utils';

type Step = 'categories' | 'form' | 'receipt' | 'receipt-confirm' | 'saving' | 'done';

interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
}

interface AddExpenseDialogProps {
  onExpenseAdded?: () => void;
}

export function AddExpenseDialog({ onExpenseAdded }: AddExpenseDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Form state
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Receipt state
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null);
  const [receiptCategory, setReceiptCategory] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep('categories');
    setSelectedCategory(null);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setParsedReceipt(null);
    setReceiptCategory(null);
    setReceiptAmount('');
    setReceiptDate('');
    setReceiptImageData(null);
  }, []);

  // Load categories & template on dialog open
  useEffect(() => {
    if (!open) return;
    setTimeout(resetState, 0);
    (async () => {
      try {
        const [cats, tmpl] = await Promise.all([
          api.getCategories(),
          api.getDefaultTemplate(),
        ]);
        setCategories(
          (cats as Category[]).sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setTemplateId(tmpl.id);
      } catch (e) {
        console.error('Failed to load data for expense dialog:', e);
      }
    })();
  }, [open, resetState]);

  // ─── Save expense ────────────────────────────────
  const saveExpense = useCallback(
    async (categoryName: string, amountValue: number, dateValue: string, imageData?: string | null) => {
      if (!templateId) return;
      setStep('saving');
      try {
        // 1. Create the expense record
        const recordData: Record<string, unknown> = {
          col_date: dateValue,
          col_type: 'Wydatek',
          col_category: [categoryName],
          col_amount: { amount: amountValue, currency: 'PLN' },
          col_person: user?.firstName ?? user?.username ?? '',
          col_paid: true,
        };

        // 2. If we have a receipt image, create a Receipt record and link it
        if (imageData) {
          try {
            const receipt = await api.createReceipt({
              description: `Paragon – ${categoryName}`,
              amount: amountValue,
              currency: 'PLN',
              date: dateValue,
              imageUrl: imageData,
              notes: parsedReceipt?.rawText?.substring(0, 2000) ?? null,
            });
            recordData._receiptId = receipt.id;
          } catch (e) {
            console.error('Failed to save receipt image, continuing without it:', e);
          }
        }

        await api.createRecord(templateId, recordData);

        setStep('done');
        onExpenseAdded?.();
        // Auto-close after a brief delay
        setTimeout(() => {
          setOpen(false);
        }, 1200);
      } catch (e) {
        console.error('Failed to save expense:', e);
        setStep('form');
        alert('Nie udało się zapisać wydatku. Spróbuj ponownie.');
      }
    },
    [templateId, user, onExpenseAdded, parsedReceipt],
  );

  // ─── Handle category selection ───────────────────
  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setStep('form');
  };

  // ─── Handle receipt result ───────────────────────
  const handleReceiptResult = (receipt: ParsedReceipt) => {
    setParsedReceipt(receipt);
    setReceiptAmount(receipt.total.toFixed(2));
    setReceiptDate(receipt.date ?? new Date().toISOString().split('T')[0]);
    setReceiptImageData(receipt.imageData);
    // Try to auto-detect category based on store name
    if (receipt.storeName) {
      const storeLower = receipt.storeName.toLowerCase();
      const autoCategory = categories.find((c) => {
        const catLower = c.name.toLowerCase();
        return storeLower.includes(catLower) || catLower.includes(storeLower);
      });
      if (autoCategory) {
        setReceiptCategory(autoCategory.name);
      }
    }
    setStep('receipt-confirm');
  };

  // ─── Handle form submit ─────────────────────────
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !amount) return;
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    saveExpense(selectedCategory, parsedAmount, date);
  };

  // ─── Handle receipt confirm ─────────────────────
  const handleReceiptConfirm = () => {
    if (!receiptCategory || !receiptAmount) return;
    const parsedAmount = parseFloat(receiptAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    saveExpense(receiptCategory, parsedAmount, receiptDate, receiptImageData);
  };

  // ─── Category icon mapping ──────────────────────
  const getCategoryIcon = (name: string) => {
    const map: Record<string, string> = {
      'Jedzenie': '🍔',
      'Transport': '🚗',
      'Rozrywka': '🎮',
      'Zdrowie': '💊',
      'Ubrania': '👕',
      'Dom': '🏠',
      'Edukacja': '📚',
      'Sport': '⚽',
      'Subskrypcje': '📱',
      'Inne': '📦',
    };
    return map[name] || '📦';
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => {
                  if (step === 'receipt-confirm') {
                    setStep('receipt');
                  } else {
                    resetState();
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'categories' && 'Nowy wydatek'}
            {step === 'form' && selectedCategory}
            {step === 'receipt' && 'Skanuj paragon'}
            {step === 'receipt-confirm' && 'Potwierdzenie'}
            {step === 'saving' && 'Zapisywanie...'}
            {step === 'done' && 'Gotowe!'}
          </DialogTitle>
        </DialogHeader>

        {/* ─── Step: Categories ──────────────────────── */}
        {step === 'categories' && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {/* Receipt scan button — first */}
            <button
              onClick={() => setStep('receipt')}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 p-4',
                'bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors',
                'text-primary cursor-pointer h-24',
              )}
            >
              <Camera className="h-7 w-7" />
              <span className="text-xs font-medium text-center leading-tight">
                Zdjęcie paragonu
              </span>
            </button>

            {/* Category buttons */}
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.name)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-xl border border-border p-4',
                  'bg-card hover:bg-accent/50 hover:border-primary/30 transition-colors',
                  'cursor-pointer h-24',
                )}
              >
                <span className="text-2xl">
                  {cat.icon || getCategoryIcon(cat.name)}
                </span>
                <span className="text-xs font-medium text-foreground text-center leading-tight">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ─── Step: Manual form ─────────────────────── */}
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
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
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-desc">Opis (opcjonalnie)</Label>
              <Input
                id="expense-desc"
                type="text"
                placeholder="np. Zakupy w Biedronce"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-11 gap-2" disabled={!amount}>
              <ShoppingCart className="h-4 w-4" />
              Dodaj wydatek
            </Button>
          </form>
        )}

        {/* ─── Step: Receipt scanner ─────────────────── */}
        {step === 'receipt' && (
          <ReceiptScanner
            onResult={handleReceiptResult}
            onCancel={() => setStep('categories')}
          />
        )}

        {/* ─── Step: Receipt confirm ─────────────────── */}
        {step === 'receipt-confirm' && parsedReceipt && (
          <div className="space-y-4 py-2">
            {/* Store name */}
            {parsedReceipt.storeName && (
              <div className="text-center">
                <Badge variant="secondary" className="text-sm">
                  {parsedReceipt.storeName}
                </Badge>
              </div>
            )}

            {/* Items list */}
            {parsedReceipt.items.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3">
                {parsedReceipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">
                      {item.quantity > 1 ? `${item.quantity}x ` : ''}
                      {item.name}
                    </span>
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {item.total.toFixed(2)} zł
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Editable total */}
            <div className="space-y-2">
              <Label htmlFor="receipt-amount">Kwota łączna (PLN)</Label>
              <Input
                id="receipt-amount"
                type="text"
                inputMode="decimal"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                className="text-lg h-12 font-semibold"
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="receipt-date">Data</Label>
              <Input
                id="receipt-date"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
              />
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setReceiptCategory(cat.name)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors',
                      receiptCategory === cat.name
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/40',
                    )}
                  >
                    <span className="text-sm">{cat.icon || getCategoryIcon(cat.name)}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleReceiptConfirm}
              className="w-full h-11 gap-2"
              disabled={!receiptCategory || !receiptAmount}
            >
              <CheckCircle2 className="h-4 w-4" />
              Zapisz wydatek
            </Button>
          </div>
        )}

        {/* ─── Step: Saving ──────────────────────────── */}
        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Zapisywanie wydatku...</p>
          </div>
        )}

        {/* ─── Step: Done ────────────────────────────── */}
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
