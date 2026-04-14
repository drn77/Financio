'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileText, AlertCircle, Loader2, Check } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ColumnDef {
  id: string;
  name: string;
  type: string;
}

interface ParsedRow {
  data: Record<string, any>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnDef[];
  categories: any[];
  onImport: (records: { data: Record<string, any> }[]) => Promise<void>;
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semiCount >= commaCount ? ';' : ',';
}

function guessColumnMapping(header: string, columns: ColumnDef[]): string {
  const h = header.toLowerCase().trim();
  const dateKeywords = ['data', 'date', 'dzień'];
  const typeKeywords = ['typ', 'type', 'rodzaj'];
  const categoryKeywords = ['kategoria', 'category', 'kat'];
  const amountKeywords = ['kwota', 'amount', 'suma', 'wartość', 'cena'];
  const personKeywords = ['osoba', 'person', 'kto', 'użytkownik'];
  const paidKeywords = ['opłacone', 'paid', 'zapłacone', 'status'];

  for (const col of columns) {
    if (col.id === 'col_date' && dateKeywords.some((k) => h.includes(k))) return col.id;
    if (col.id === 'col_type' && typeKeywords.some((k) => h.includes(k))) return col.id;
    if (col.id === 'col_category' && categoryKeywords.some((k) => h.includes(k))) return col.id;
    if (col.id === 'col_amount' && amountKeywords.some((k) => h.includes(k))) return col.id;
    if (col.id === 'col_person' && personKeywords.some((k) => h.includes(k))) return col.id;
    if (col.id === 'col_paid' && paidKeywords.some((k) => h.includes(k))) return col.id;
  }

  return '';
}

function convertValue(raw: string, colId: string, _columns: ColumnDef[]): any {
  const s = raw.trim();

  if (colId === 'col_date') {
    // Try to parse various date formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
      const [d, m, y] = s.split('.');
      return `${y}-${m}-${d}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m}-${d}`;
    }
    return s;
  }

  if (colId === 'col_amount') {
    const cleanNum = s.replace(/[^0-9.,\-]/g, '').replace(',', '.');
    const num = parseFloat(cleanNum);
    const currencyMatch = s.match(/[A-Z]{3}/);
    return { amount: isNaN(num) ? 0 : num, currency: currencyMatch?.[0] ?? 'PLN' };
  }

  if (colId === 'col_category') {
    return s ? s.split(/[,;]/).map((c) => c.trim()).filter(Boolean) : [];
  }

  if (colId === 'col_paid') {
    const lower = s.toLowerCase();
    return lower === 'tak' || lower === 'true' || lower === '1' || lower === 'yes';
  }

  return s;
}

export function CSVImportDialog({ open, onOpenChange, columns, categories, onImport }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [importCount, setImportCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError('');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = (e.target?.result as string) ?? '';
          const sep = detectSeparator(text);
          const lines = text.split('\n').filter((l) => l.trim());

          if (lines.length < 2) {
            setError('Plik musi zawierać nagłówek i co najmniej jeden wiersz danych.');
            return;
          }

          const hdrs = parseCSVLine(lines[0], sep);
          setHeaders(hdrs);

          // Auto-detect column mapping
          const autoMapping: Record<number, string> = {};
          hdrs.forEach((h, i) => {
            const guess = guessColumnMapping(h, columns);
            if (guess) autoMapping[i] = guess;
          });
          setMapping(autoMapping);

          // Parse data rows
          const rows: ParsedRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i], sep);
            const data: Record<string, any> = {};

            Object.entries(autoMapping).forEach(([idx, colId]) => {
              data[colId] = convertValue(vals[Number(idx)] ?? '', colId, columns);
            });

            // Fill defaults for unmapped columns
            for (const col of columns) {
              if (!(col.id in data)) {
                if (col.type === 'checkbox') data[col.id] = false;
                else if (col.type === 'currency') data[col.id] = { amount: 0, currency: 'PLN' };
                else if (col.type === 'tag_group') data[col.id] = [];
                else data[col.id] = '';
              }
            }

            rows.push({ data });
          }

          setParsedRows(rows);
          setStep('preview');
        } catch {
          setError('Nie udało się sparsować pliku CSV.');
        }
      };
      reader.readAsText(file, 'utf-8');
    },
    [columns],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = useCallback(async () => {
    setStep('importing');
    try {
      await onImport(parsedRows);
      setImportCount(parsedRows.length);
      setStep('done');
    } catch {
      setError('Import nie powiódł się.');
      setStep('preview');
    }
  }, [parsedRows, onImport]);

  const handleClose = useCallback(() => {
    setStep('upload');
    setParsedRows([]);
    setHeaders([]);
    setMapping({});
    setError('');
    setImportCount(0);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Przeciągnij plik CSV lub kliknij aby wybrać</p>
            <p className="text-xs text-muted-foreground mt-1">Obsługiwane separatory: ; (średnik) i , (przecinek)</p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Znaleziono <strong>{parsedRows.length}</strong> wierszy
              </p>
              <div className="flex gap-1.5">
                {Object.values(mapping).map((colId) => {
                  const col = columns.find((c) => c.id === colId);
                  return col ? (
                    <Badge key={colId} variant="secondary" className="text-xs">
                      {col.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>

            <ScrollArea className="max-h-64 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {headers.map((h, i) => (
                      <TableHead key={i} className="min-w-[100px]">
                        <span className="text-xs">{h}</span>
                        {mapping[i] && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            → {columns.find((c) => c.id === mapping[i])?.name ?? mapping[i]}
                          </Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {headers.map((_, ci) => {
                        const colId = mapping[ci];
                        const v = colId ? row.data[colId] : '—';
                        const display =
                          typeof v === 'object' && v?.amount != null
                            ? `${v.amount} ${v.currency}`
                            : Array.isArray(v)
                              ? v.join(', ')
                              : String(v ?? '');
                        return (
                          <TableCell key={ci} className="text-xs">
                            {display}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {parsedRows.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={headers.length + 1} className="text-center text-xs text-muted-foreground">
                        ...i {parsedRows.length - 10} więcej wierszy
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Importuję {parsedRows.length} wierszy...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30 mb-3">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">Zaimportowano {importCount} wierszy</p>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Wróć
              </Button>
              <Button onClick={handleImport}>
                Importuj {parsedRows.length} wierszy
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Zamknij</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
