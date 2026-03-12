'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastError } from '@/lib/toast';


export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ParsedReceipt {
  storeName: string | null;
  date: string | null;
  items: ParsedReceiptItem[];
  total: number;
  rawText: string;
  imageData: string | null; // base64 data URL of the receipt photo
}

type ScanStage = 'capture' | 'processing' | 'done' | 'error';

interface ReceiptScannerProps {
  onResult: (receipt: ParsedReceipt) => void;
  onCancel: () => void;
}

// ─── Image compression ─────────────────────────────

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

// ─── Receipt text parser ────────────────────────────

// Helper: normalise OCR artefacts common in Polish receipt scanning
function normaliseLine(line: string): string {
  return line
    .replace(/\|/g, 'l')      // pipe → l
    .replace(/[{}]/g, '')      // stray braces
    .replace(/\s{2,}/g, ' ')  // collapse whitespace
    .trim();
}

function parseReceiptText(text: string): Omit<ParsedReceipt, 'imageData'> {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.map(normaliseLine).filter(Boolean);

  // ─── Store name ─────────────────────────────────
  // Skip lines that look like header noise (NIP, address, phone etc.)
  const headerNoise = /^(nip|tel|ul\.|al\.|www\.|http|[0-9]{3}[\s-]|paragon|fisk|kasa|nr |wydr)/i;
  let storeName: string | null = null;
  for (const line of lines.slice(0, 6)) {
    if (headerNoise.test(line)) continue;
    if (line.length < 3) continue;
    // Skip lines that are mostly numbers or punctuation
    const letterRatio = (line.match(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length / line.length;
    if (letterRatio > 0.4) {
      storeName = line;
      break;
    }
  }

  // ─── Date ──────────────────────────────────────
  let date: string | null = null;
  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,                          // YYYY-MM-DD
    /(\d{2})[.\-/](\d{2})[.\-/](\d{4})/,                // DD.MM.YYYY
    /(\d{2})-(\d{2})-(\d{2})(?:\s|$)/,                   // DD-MM-YY
  ];
  for (const line of lines) {
    for (const rx of datePatterns) {
      const m = line.match(rx);
      if (!m) continue;
      if (m[0].length === 10 && m[1].length === 4) {
        date = `${m[1]}-${m[2]}-${m[3]}`;
      } else if (m[3] && m[3].length === 4) {
        date = `${m[3]}-${m[2]}-${m[1]}`;
      } else if (m[3] && m[3].length === 2) {
        const yr = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
        date = `${yr}-${m[2]}-${m[1]}`;
      }
      if (date) break;
    }
    if (date) break;
  }

  // ─── Items ──────────────────────────────────────
  // Polish receipts commonly have two layouts:
  //   A) Single line:  "ITEM NAME     2 x 3,50    7,00A"
  //   B) Two lines:    "ITEM NAME"
  //                    "   2 szt. x 3,50       7,00A"
  //   C) Single line with just price: "ITEM NAME    7,00A"

  const items: ParsedReceiptItem[] = [];

  // Words/patterns that signal total/summary lines (not items)
  const skipPatterns = /^(suma|razem|total|sprzeda|do zap|zap[łl]a|reszta|got[oó]wk|karta|ptu|vat|netto|brutto|podatek|nip|nr |paragon|fisk|kasa|zmiana|data|czas|#|---|\*\*\*|rabat|upust|bon )/i;
  // "Tender" lines (payment methods)
  const tenderPatterns = /\b(got[oó]wk|karta|przelew|blik|mastercard|visa|płatność)\b/i;

  // Price at end of line: "7,00" or "7.00" optionally followed by tax letter (A-D) or *
  const endPriceRx = /(\d{1,6}[.,]\d{2})\s*[A-D*]?\s*$/;
  // Quantity line: "2 szt", "2szt", "2 x", "2x", "0,500 kg", "2 szt."
  const qtyLineRx = /^[\s]*(\d+[.,]?\d*)\s*(?:szt\.?|kg|g|l|ml|op\.?|x)\s*/i;
  // Inline quantity: "2 x 3,50" or "2x3,50" or "2szt.x3,50" or "2 szt x 3,50"
  const inlineQtyRx = /(\d+[.,]?\d*)\s*(?:szt\.?\s*)?[xX*×]\s*(\d+[.,]\d{2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip summary/noise lines
    if (skipPatterns.test(line)) continue;
    if (tenderPatterns.test(line)) continue;

    const priceMatch = line.match(endPriceRx);
    if (!priceMatch) {
      // Check if this is a name-only line followed by a quantity+price line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextPrice = nextLine.match(endPriceRx);
        const nextQty = nextLine.match(qtyLineRx) || nextLine.match(inlineQtyRx);
        if (nextPrice && nextQty) {
          // This line is the item name, next line has qty + price
          const name = line.replace(/\s+/g, ' ').trim();
          const total = parseFloat(nextPrice[1].replace(',', '.'));
          if (skipPatterns.test(name) || total > 9999 || total <= 0 || name.length < 2) continue;

          let quantity = 1;
          let unitPrice = total;
          const iqm = nextLine.match(inlineQtyRx);
          if (iqm) {
            quantity = parseFloat(iqm[1].replace(',', '.'));
            unitPrice = parseFloat(iqm[2].replace(',', '.'));
          } else {
            const qm = nextLine.match(qtyLineRx);
            if (qm) {
              quantity = parseFloat(qm[1].replace(',', '.'));
              unitPrice = quantity > 0 ? Math.round((total / quantity) * 100) / 100 : total;
            }
          }

          if (name) {
            items.push({ name, quantity, unitPrice, total });
          }
          i++; // skip the next line since we consumed it
          continue;
        }
      }
      continue;
    }

    // This line has a price at the end
    const totalStr = priceMatch[1].replace(',', '.');
    const total = parseFloat(totalStr);

    if (total <= 0 || total > 9999) continue;

    // Extract item name (everything before the price area)
    let name = line.substring(0, priceMatch.index).trim();

    let quantity = 1;
    let unitPrice = total;

    // Check for inline quantity pattern
    const iqm = name.match(inlineQtyRx);
    if (iqm) {
      quantity = parseFloat(iqm[1].replace(',', '.'));
      unitPrice = parseFloat(iqm[2].replace(',', '.'));
      name = name.substring(0, iqm.index).trim();
    }

    // Clean trailing quantity info like "2 szt." at end of name
    name = name.replace(/\s+\d+[.,]?\d*\s*(?:szt\.?|kg|g|l|ml|op\.?)\s*$/i, '').trim();
    // Remove trailing single letters (tax markers that ended up in name)
    name = name.replace(/\s+[A-D]\s*$/, '').trim();

    if (name.length < 2) continue;
    if (skipPatterns.test(name)) continue;

    items.push({ name, quantity, unitPrice, total });
  }

  // ─── Grand total ────────────────────────────────
  let grandTotal = 0;
  // Look for the largest "total" line
  const totalRx = /(?:suma|razem|do zap[łl]aty|total|sprzeda[żz])\s*:?\s*(\d+[.,]\d{2})/i;
  for (const line of lines) {
    const m = line.match(totalRx);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > grandTotal) grandTotal = val;
    }
  }

  // Also look for standalone "PLN" amounts
  const plnTotalRx = /(\d+[.,]\d{2})\s*(?:PLN|zł|Z[LŁ])/i;
  for (const line of lines) {
    if (!totalRx.test(line)) continue; // only check on total-like lines
    const m = line.match(plnTotalRx);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > grandTotal) grandTotal = val;
    }
  }

  // Fallback: sum of items
  if (grandTotal === 0 && items.length > 0) {
    grandTotal = items.reduce((sum, item) => sum + item.total, 0);
  }

  return {
    storeName,
    date: date || new Date().toISOString().split('T')[0],
    items,
    total: Math.round(grandTotal * 100) / 100,
    rawText: text,
  };
}

// ─── Component ──────────────────────────────────────

export function ReceiptScanner({ onResult, onCancel }: ReceiptScannerProps) {
  const [stage, setStage] = useState<ScanStage>('capture');
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      // Read image for preview
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      setImagePreview(dataUrl);

      setStage('processing');
      setProgress(0);

      try {
        // Compress the image for storage (max 1200px, 75% quality JPEG)
        const compressed = await compressImage(dataUrl);

        // Dynamic import for code splitting - Tesseract is ~17MB
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('pol+eng', undefined, {
          logger: (m: { progress: number }) => {
            setProgress(Math.round(m.progress * 100));
          },
        });

        const {
          data: { text },
        } = await worker.recognize(file);
        await worker.terminate();

        const parsed = parseReceiptText(text);

        if (parsed.items.length === 0 && parsed.total === 0) {
          setError('Nie udało się rozpoznać pozycji na paragonie. Spróbuj ponownie z lepszym zdjęciem.');
          setStage('error');
          return;
        }

        setStage('done');
        onResult({ ...parsed, imageData: compressed });
      } catch (err) {
        console.error('OCR error:', err);
        toastError('Błąd podczas skanowania paragonu. Spróbuj ponownie.');
        setError('Błąd podczas skanowania. Spróbuj ponownie.');
        setStage('error');
      }
    },
    [onResult],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
    },
    [processImage],
  );

  const handleRetry = () => {
    setStage('capture');
    setProgress(0);
    setImagePreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ─── Capture stage ──────────────────────────────────
  if (stage === 'capture') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Camera className="h-10 w-10" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Zeskanuj paragon</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Zrób zdjęcie paragonu lub wybierz z galerii. Najlepiej w dobrym oświetleniu na płaskiej powierzchni.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <Button
            onClick={() => inputRef.current?.click()}
            className="flex-1 h-12 gap-2"
          >
            <Camera className="h-5 w-5" />
            Zrób zdjęcie
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Create a separate input without capture attribute for gallery
              const galleryInput = document.createElement('input');
              galleryInput.type = 'file';
              galleryInput.accept = 'image/*';
              galleryInput.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) processImage(file);
              };
              galleryInput.click();
            }}
            className="flex-1 h-12 gap-2"
          >
            <Upload className="h-5 w-5" />
            Z galerii
          </Button>
        </div>

        <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
          Anuluj
        </Button>
      </div>
    );
  }

  // ─── Processing stage ───────────────────────────────
  if (stage === 'processing') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        {imagePreview && (
          <div className="w-32 h-44 rounded-lg overflow-hidden border border-border/50 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Paragon" className="w-full h-full object-cover" />
          </div>
        )}
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Skanowanie...</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Rozpoznawanie tekstu — {progress}%
          </p>
        </div>
        <div className="w-48 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ─── Error stage ────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <XCircle className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Błąd skanowania</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Spróbuj ponownie
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
        </div>
      </div>
    );
  }

  // ─── Done (briefly shown, parent handles result) ────
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Rozpoznano!</h3>
    </div>
  );
}
