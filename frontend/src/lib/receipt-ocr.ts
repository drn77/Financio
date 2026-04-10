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

export interface ReceiptOcrOptions {
  onProgress?: (progress: number) => void;
  onStage?: (message: string) => void;
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
    .replace(/\u00a0/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseMoney(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractMoneyValues(line: string): number[] {
  const matches = line.match(/\d{1,6}[.,]\d{2}/g) ?? [];
  return matches.map(parseMoney).filter((v) => v > 0);
}

function isLikelyHeaderOrMeta(line: string): boolean {
  return /^(nip|regon|krs|faktura|forma płatności|termin płatności|sprzedawca|nabywca|adres|data|nr |www\.|tel\.?)/i.test(line);
}

const invoiceMetaLabel = /^(wystawca|nabywca|sprzedawca|kupuj|odbiorca|płatnik|adres|faktura|rachunek|nr |nip|regon|krs|tel|www|http|ul\.|al\.|paragon|fisk|kasa|wydr|data|forma|termin|lp\b|nazwa towaru|jm\b|ilo[śs][ćc]|cena|warto[śs][ćc]|rabat|vat|kwota|brutto|netto|razem|suma|do zap[łl]aty|nr rejestracyjny|strona|s[łl]ownie|zap[łl]acono|w tym|dok\.|do dokument)/i;

function inferUnitPrice(quantity: number, total: number, numericCandidates: number[]): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return total;
  if (numericCandidates.length === 0) return Math.round((total / quantity) * 100) / 100;

  let best = numericCandidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of numericCandidates) {
    const diff = Math.abs((candidate * quantity) - total);
    if (diff < bestScore) {
      best = candidate;
      bestScore = diff;
    }
  }
  return best;
}

function parseInvoiceLikeItems(lines: string[]): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const quantityUnitRx = /(\d+[.,]?\d*)\s*(szt\.?|sztuk|litr|l|kg|g|ml|m|opak|op\.?)/i;

  for (const rawLine of lines) {
    const line = normaliseLine(rawLine);
    if (!line || isLikelyHeaderOrMeta(line)) continue;
    if (/^razem\b/i.test(line)) continue;

    const quantityMatch = line.match(quantityUnitRx);
    const moneyValues = extractMoneyValues(line);

    if (!quantityMatch || moneyValues.length < 2) continue;

    const quantity = parseMoney(quantityMatch[1]);
    if (quantity <= 0) continue;

    const total = moneyValues[moneyValues.length - 1];
    if (total <= 0) continue;

    const name = line.slice(0, quantityMatch.index).replace(/[|\-:;]+$/g, '').trim();
    if (name.length < 2) continue;

    const candidates = moneyValues.slice(0, -1);
    const unitPrice = inferUnitPrice(quantity, total, candidates);

    items.push({
      name,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  }

  return items;
}

/** Parse items from multi-line tabular invoices (one value per line) */
function parseMultiLineInvoiceItems(lines: string[]): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const unitRx = /^(szt\.?|sztuk|litr|l|kg|g|ml|m|opak|op\.?)$/i;

  // Find item table start: a standalone "1" that starts the first item
  // Must come after column header region (after lines with "brutto"/"nazwa"/"lp")
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(lp|nazwa|jm)\b/i.test(lines[i])) {
      // Found column headers, scan ahead for first item number
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j] === '1') { tableStart = j; break; }
      }
      if (tableStart > 0) break;
    }
  }
  // Fallback: look for standalone "1" preceded by "brutto" within 10 lines
  if (tableStart < 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '1') {
        const context = lines.slice(Math.max(0, i - 10), i).join(' ').toLowerCase();
        if (context.includes('brutto') || context.includes('nazwa') || context.includes('lp')) {
          tableStart = i;
          break;
        }
      }
    }
  }
  if (tableStart < 0) return [];

  // Find table end: "Razem" or "w tym" line
  let tableEnd = lines.length;
  for (let i = tableStart; i < lines.length; i++) {
    if (/^(razem|w tym)\s*:?/i.test(lines[i])) { tableEnd = i; break; }
  }

  // Parse items: each item starts with a sequential number
  let currentName = '';
  let currentNumbers: number[] = [];
  let expectedItemNum = 1;

  const flushItem = () => {
    if (currentName && currentNumbers.length >= 2) {
      // First number = quantity, last = total brutto
      const quantity = currentNumbers[0];
      const total = currentNumbers[currentNumbers.length - 1];
      const unitPrice = quantity > 0 ? Math.round((total / quantity) * 100) / 100 : total;
      items.push({
        name: currentName,
        quantity: Math.round(quantity * 1000) / 1000,
        unitPrice,
        total: Math.round(total * 100) / 100,
      });
    }
  };

  for (let i = tableStart; i < tableEnd; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if this is a new item number
    if (/^\d{1,3}$/.test(line)) {
      const num = parseInt(line, 10);
      if (num === expectedItemNum) {
        flushItem();
        currentName = '';
        currentNumbers = [];
        expectedItemNum = num + 1;
        continue;
      }
    }

    // Unit (skip, don't add to name or numbers)
    if (unitRx.test(line)) continue;

    // Try as number
    const cleaned = line.replace(/\s/g, '').replace(',', '.');
    const asNum = Number.parseFloat(cleaned);
    if (/^\d/.test(cleaned) && Number.isFinite(asNum)) {
      currentNumbers.push(asNum);
      continue;
    }

    // Must be part of name
    if (!currentName && line.length >= 2 && !invoiceMetaLabel.test(line)) {
      currentName = line;
    }
  }
  flushItem();

  return items;
}

/** Detect grand total with multi-line support (keyword on one line, amount on next) */
function parseMultiLineGrandTotal(lines: string[]): number {
  let best = 0;
  const totalKeywords = /\b(razem|do zap[łl]aty|suma|warto[śs][ćc] brutto|nale[żz]no[śs][ćc] og[oó][łl]em|nale[żz]no[śs][ćc])\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = normaliseLine(lines[i]);
    if (!line) continue;

    if (totalKeywords.test(line)) {
      // Same line
      const sameValues = extractMoneyValues(line);
      if (sameValues.length > 0) {
        const candidate = sameValues[sameValues.length - 1];
        if (candidate > best) best = candidate;
        continue;
      }
      // Next few lines
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const nextLine = normaliseLine(lines[i + j]);
        const nextValues = extractMoneyValues(nextLine);
        if (nextValues.length > 0) {
          const candidate = nextValues[nextValues.length - 1];
          if (candidate > best) best = candidate;
          break;
        }
      }
    }
  }

  // Also check PLN amount patterns across all lines
  const plnRx = /(\d+[.,]\d{2})\s*(?:PLN|z[łl]|Z[LŁ])/i;
  for (const rawLine of lines) {
    const line = normaliseLine(rawLine);
    const m = line.match(plnRx);
    if (m) {
      const val = parseMoney(m[1]);
      if (val > best) best = val;
    }
  }

  return best;
}

export function parseReceiptText(text: string): ParsedReceiptResult {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.map(normaliseLine).filter(Boolean);
  const isInvoice = lines.some(l => /faktura/i.test(l));

  // --- Store name ---
  let storeName: string | null = null;

  if (isInvoice) {
    // For invoices, look for company name after "Wystawca:" or "Sprzedawca:"
    for (let i = 0; i < lines.length; i++) {
      if (/^(wystawca|sprzedawca)\s*:?\s*$/i.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (invoiceMetaLabel.test(lines[j])) continue;
          if (lines[j].length < 3) continue;
          const letterRatio = (lines[j].match(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ.]/g) || []).length / lines[j].length;
          if (letterRatio > 0.3) {
            storeName = lines[j];
            break;
          }
        }
        if (storeName) break;
      }
    }
  }

  if (!storeName) {
    const headerNoise = /^(nip|tel|ul\.|al\.|www\.|http|[0-9]{3}[\s-]|paragon|fisk|kasa|nr |wydr)/i;
    for (const line of lines.slice(0, 6)) {
      if (headerNoise.test(line) || invoiceMetaLabel.test(line)) continue;
      if (line.length < 3) continue;
      const letterRatio = (line.match(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length / line.length;
      if (letterRatio > 0.4) {
        storeName = line;
        break;
      }
    }
  }

  // --- Date ---
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

  // --- Items ---
  // Try single-line invoice items first
  let items: ParsedReceiptItem[] = parseInvoiceLikeItems(lines);

  // Try multi-line invoice items if single-line found nothing
  if (items.length === 0 && isInvoice) {
    items = parseMultiLineInvoiceItems(lines);
  }

  // Try receipt-style single-line items
  if (items.length === 0) {
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
  }

  // --- Grand total (multi-line aware) ---
  let grandTotal = parseMultiLineGrandTotal(rawLines);

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

async function loadPdfJs(): Promise<any> {
  try {
    return await import('pdfjs-dist/legacy/build/pdf.mjs') as any;
  } catch {
    return await import('pdfjs-dist') as any;
  }
}

function getPdfjsCMapUrl(): string {
  // Use CDN cMaps for browser (browser fetch doesn't support file://)
  // pdfjs-dist version must match the installed package
  return 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/cmaps/';
}

function getPdfjsStandardFontUrl(): string {
  return 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/standard_fonts/';
}

async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const pdfjs = await loadPdfJs();

    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({
      data,
      disableWorker: true,
      cMapUrl: getPdfjsCMapUrl(),
      cMapPacked: true,
      standardFontDataUrl: getPdfjsStandardFontUrl(),
    }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = (content.items as any[])
        .map((item) => String(item?.str ?? '').trim())
        .filter(Boolean);
      if (lines.length > 0) pages.push(lines.join('\n'));
    }

    return pages.join('\n\n');
  } catch {
    return '';
  }
}

async function renderFirstPdfPageToImageDataUrl(file: File): Promise<string | null> {
  // Try rendering with minimal options first (most compatible for image-only PDFs)
  // Then with cMaps if first try fails
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());

  const optionSets = [
    { data, disableWorker: true },
    {
      data: new Uint8Array(data),
      disableWorker: true,
      cMapUrl: getPdfjsCMapUrl(),
      cMapPacked: true,
      standardFontDataUrl: getPdfjsStandardFontUrl(),
    },
  ];

  for (const opts of optionSets) {
    try {
      const doc = await pdfjs.getDocument(opts).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 3 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Convert to grayscale + increase contrast for better OCR
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imgData.data;
      for (let i = 0; i < px.length; i += 4) {
        const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const v = Math.round(gray < 128 ? Math.max(0, gray * 0.6) : Math.min(255, gray * 1.2 + 30));
        px[i] = v; px[i + 1] = v; px[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);

      const result = canvas.toDataURL('image/png');
      if (result && result.length > 100) return result;
    } catch {
      // Try next option set
    }
  }
  return null;
}

export async function runReceiptOcr(
  file: File,
  options?: ReceiptOcrOptions,
): Promise<ParsedReceiptResult> {
  const onProgress = options?.onProgress;
  const onStage = options?.onStage;
  onStage?.('Start OCR: przygotowanie pliku');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let ocrInput: File | string = file;

  if (isPdf) {
    onStage?.('Wykryto PDF: próba odczytu tekstu warstwy PDF');
    let pdfText = '';
    try {
      pdfText = await extractTextFromPdf(file);
    } catch (e) {
      onStage?.(`PDF: błąd odczytu tekstu: ${e instanceof Error ? e.message : 'unknown'}`);
    }
    const cleanPdfText = pdfText.replace(/\s+/g, ' ').trim();
    const hasLikelyContent = cleanPdfText.length >= 40;

    if (hasLikelyContent) {
      onStage?.(`PDF: odczytano tekst (${cleanPdfText.length} znaków), parsowanie paragonu`);
      return parseReceiptText(pdfText);
    }

    if (cleanPdfText.length > 0) {
      onStage?.(`PDF: tekst zbyt krótki (${cleanPdfText.length} znaków), fallback do OCR`);
    } else {
      onStage?.('PDF: brak tekstu, fallback do OCR');
    }

    onStage?.('PDF: render strony 1 do obrazu');
    let renderedPage: string | null = null;
    try {
      renderedPage = await renderFirstPdfPageToImageDataUrl(file);
    } catch (e) {
      onStage?.(`PDF: błąd renderowania: ${e instanceof Error ? e.message : 'unknown'}`);
    }
    if (!renderedPage) {
      throw new Error('Nie udało się wyrenderować PDF do obrazu. OCR wymaga backendu (render-ocr).');
    }
    ocrInput = renderedPage;
    onStage?.('PDF: przejście do OCR obrazu');
  }

  onStage?.('OCR: uruchamianie silnika Tesseract');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('pol+eng', undefined, {
    logger: (m: { progress: number }) => {
      if (onProgress) onProgress(Math.round(m.progress * 100));
    },
  });

  try {
    onStage?.('OCR: rozpoznawanie tekstu');
    const {
      data: { text },
    } = await worker.recognize(ocrInput);
    onStage?.('OCR: zakończono rozpoznawanie, parsowanie wyniku');
    return parseReceiptText(text);
  } finally {
    await worker.terminate();
    onStage?.('OCR: zakończono proces');
  }
}
