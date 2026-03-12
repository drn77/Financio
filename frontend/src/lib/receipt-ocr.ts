/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ParsedReceiptResult {
  storeName: string | null;
  date: string | null;
  items: ParsedReceiptItem[];
  total: number;
  rawText: string;
}

export function compressImage(dataUrl: string, maxWidth = 1200, quality = 0.75): Promise<string> {
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
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normaliseLine(line: string): string {
  return line
    .replace(/\|/g, 'l')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseReceiptText(text: string): ParsedReceiptResult {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.map(normaliseLine).filter(Boolean);

  const headerNoise = /^(nip|tel|ul\.|al\.|www\.|http|[0-9]{3}[\s-]|paragon|fisk|kasa|nr |wydr)/i;
  let storeName: string | null = null;
  for (const line of lines.slice(0, 6)) {
    if (headerNoise.test(line)) continue;
    if (line.length < 3) continue;
    const letterRatio = (line.match(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length / line.length;
    if (letterRatio > 0.4) {
      storeName = line;
      break;
    }
  }

  let date: string | null = null;
  const datePatterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})[.\-/](\d{2})[.\-/](\d{4})/,
    /(\d{2})-(\d{2})-(\d{2})(?:\s|$)/,
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
        const yr = parseInt(m[3], 10) > 50 ? `19${m[3]}` : `20${m[3]}`;
        date = `${yr}-${m[2]}-${m[1]}`;
      }
      if (date) break;
    }
    if (date) break;
  }

  const items: ParsedReceiptItem[] = [];
  const skipPatterns = /^(suma|razem|total|sprzeda|do zap|zap[łl]a|reszta|got[oó]wk|karta|ptu|vat|netto|brutto|podatek|nip|nr |paragon|fisk|kasa|zmiana|data|czas|#|---|\*\*\*|rabat|upust|bon )/i;
  const tenderPatterns = /\b(got[oó]wk|karta|przelew|blik|mastercard|visa|płatność)\b/i;
  const endPriceRx = /(\d{1,6}[.,]\d{2})\s*[A-D*]?\s*$/;
  const qtyLineRx = /^[\s]*(\d+[.,]?\d*)\s*(?:szt\.?|kg|g|l|ml|op\.?|x)\s*/i;
  const inlineQtyRx = /(\d+[.,]?\d*)\s*(?:szt\.?\s*)?[xX*×]\s*(\d+[.,]\d{2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (skipPatterns.test(line)) continue;
    if (tenderPatterns.test(line)) continue;

    const priceMatch = line.match(endPriceRx);
    if (!priceMatch) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextPrice = nextLine.match(endPriceRx);
        const nextQty = nextLine.match(qtyLineRx) || nextLine.match(inlineQtyRx);
        if (nextPrice && nextQty) {
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

          items.push({ name, quantity, unitPrice, total });
          i++;
          continue;
        }
      }
      continue;
    }

    const total = parseFloat(priceMatch[1].replace(',', '.'));
    if (total <= 0 || total > 9999) continue;

    let name = line.substring(0, priceMatch.index).trim();
    let quantity = 1;
    let unitPrice = total;

    const iqm = name.match(inlineQtyRx);
    if (iqm) {
      quantity = parseFloat(iqm[1].replace(',', '.'));
      unitPrice = parseFloat(iqm[2].replace(',', '.'));
      name = name.substring(0, iqm.index).trim();
    }

    name = name.replace(/\s+\d+[.,]?\d*\s*(?:szt\.?|kg|g|l|ml|op\.?)\s*$/i, '').trim();
    name = name.replace(/\s+[A-D]\s*$/, '').trim();

    if (name.length < 2) continue;
    if (skipPatterns.test(name)) continue;

    items.push({ name, quantity, unitPrice, total });
  }

  let grandTotal = 0;
  const totalRx = /(?:suma|razem|do zap[łl]aty|total|sprzeda[żz])\s*:?\s*(\d+[.,]\d{2})/i;
  for (const line of lines) {
    const m = line.match(totalRx);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > grandTotal) grandTotal = val;
    }
  }

  const plnTotalRx = /(\d+[.,]\d{2})\s*(?:PLN|zł|Z[LŁ])/i;
  for (const line of lines) {
    if (!totalRx.test(line)) continue;
    const m = line.match(plnTotalRx);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > grandTotal) grandTotal = val;
    }
  }

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

export async function runReceiptOcr(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ParsedReceiptResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('pol+eng', undefined, {
    logger: (m: { progress: number }) => {
      if (onProgress) onProgress(Math.round(m.progress * 100));
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return parseReceiptText(text);
  } finally {
    await worker.terminate();
  }
}
