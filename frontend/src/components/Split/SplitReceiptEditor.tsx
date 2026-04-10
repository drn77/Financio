'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { ISplitParticipant } from '@shared/models';

// ─── Types ──────────────────────────────────────────

interface ItemRow {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Props {
  splitId: string;
  participantId: string;
  participants: ISplitParticipant[];
  guestToken: string | null;
  onClose: () => void;
  onCreated: () => void;
}

// ─── Image compression (reuse pattern from ReceiptScanner) ──

function compressImage(dataUrl: string, maxWidth = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ─── Component ──────────────────────────────────────

export function SplitReceiptEditor({ splitId, participantId, participants, guestToken, onClose, onCreated }: Props) {
  // ─── state ────────────────────────────────────────
  const [storeName, setStoreName] = useState('');
  const [paidById, setPaidById] = useState(participantId);
  const [items, setItems] = useState<ItemRow[]>([{ name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── helpers ──────────────────────────────────────

  const totalAmount = items.reduce((sum, it) => sum + (it.total || 0), 0);

  const updateItem = (idx: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      // Recalculate total when quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = Math.round(item.quantity * item.unitPrice * 100) / 100;
      }
      // Recalculate unitPrice when total changes (keep quantity fixed)
      if (field === 'total' && item.quantity > 0) {
        item.unitPrice = Math.round(((item.total as number) / item.quantity) * 100) / 100;
      }
      next[idx] = item;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleScan = useCallback(async (file: File) => {
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      const compressed = await compressImage(dataUrl);
      setImageUrl(compressed);

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('pol+eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      setOcrRawText(text);

      // Simple item parsing from OCR text
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const endPriceRx = /(\d{1,6}[.,]\d{2})\s*[A-D*]?\s*$/;
      const skipRx = /^(suma|razem|total|sprzeda|do zap|zap[łl]a|reszta|got|karta|ptu|vat|nip|nr |paragon|fisk|kasa|data|czas)/i;
      const parsed: ItemRow[] = [];

      for (const line of lines) {
        if (skipRx.test(line)) continue;
        const pm = line.match(endPriceRx);
        if (!pm) continue;
        const total = parseFloat(pm[1].replace(',', '.'));
        if (total <= 0 || total > 9999) continue;
        let name = line.substring(0, pm.index).replace(/\s+/g, ' ').trim();
        name = name.replace(/\s+[A-D]\s*$/, '').trim();
        if (name.length < 2) continue;
        parsed.push({ name, quantity: 1, unitPrice: total, total });
      }

      if (parsed.length > 0) {
        setItems(parsed);
      }
    } catch {
      toastError('Błąd OCR — dodaj pozycje ręcznie');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleScan(file);
  };

  const handleSubmit = async () => {
    const validItems = items.filter((it) => it.name.trim() && it.total > 0);
    if (validItems.length === 0) {
      toastError('Dodaj co najmniej jedną pozycję');
      return;
    }

    setSubmitting(true);
    try {
      await api.createSplitReceipt(
        splitId,
        {
          storeName: storeName || undefined,
          totalAmount: Math.round(totalAmount * 100) / 100,
          paidByParticipantId: paidById,
          imageUrl: imageUrl || undefined,
          ocrRawText: ocrRawText || undefined,
          items: validItems.map((it, i) => ({
            name: it.name.trim(),
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
            sortOrder: i,
          })),
        },
        guestToken || undefined,
      );
      toastSuccess('Paragon dodany');
      onCreated();
    } catch {
      toastError('Nie udało się dodać paragonu');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── return ───────────────────────────────────────

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Dodaj paragon</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4 pb-2">
            {/* OCR scan */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              {imageUrl ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted">
                  <img src={imageUrl} alt="Paragon" className="w-full h-full object-cover" />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => { setImageUrl(null); setOcrRawText(null); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-20 gap-2 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                >
                  {scanning ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Skanowanie…</>
                  ) : (
                    <><Camera className="h-5 w-5" /> Zeskanuj paragon (opcjonalne)</>
                  )}
                </Button>
              )}
            </div>

            {/* Store name + payer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sklep</Label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="np. Biedronka"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Zapłacił(a)</Label>
                <Select value={paidById} onValueChange={setPaidById}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Pozycje</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addItem}>
                  <Plus className="h-3 w-3" /> Dodaj
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="Nazwa"
                      className="h-8 text-sm flex-1 min-w-0"
                    />
                    <Input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Ilość"
                      className="h-8 text-sm w-14 text-center"
                      min={0}
                      step={1}
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input
                      type="number"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder="Cena"
                      className="h-8 text-sm w-20 text-right"
                      min={0}
                      step={0.01}
                    />
                    <span className="text-xs text-muted-foreground">=</span>
                    <Input
                      type="number"
                      value={item.total || ''}
                      onChange={(e) => updateItem(idx, 'total', parseFloat(e.target.value) || 0)}
                      placeholder="Suma"
                      className="h-8 text-sm w-20 text-right font-medium"
                      min={0}
                      step={0.01}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-end text-sm font-semibold pt-1 border-t">
              Razem: {totalAmount.toFixed(2)} zł
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Dodaj paragon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
