'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  MoreVertical,
  Download,
  Upload,
  Camera,
  Loader2,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Filter,
} from 'lucide-react';
import { ExpenseFilters, EMPTY_FILTERS, type IExpenseFilterState } from './ExpenseFilters';
import { ExpenseSummary } from './ExpenseSummary';
import { CSVImportDialog } from './CSVImportDialog';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ColumnDef {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  currencyOptions?: string[];
  defaultBehavior: string;
  colorFieldByTag?: string;
  colorRowByTag?: boolean;
  allowMultiple?: boolean;
  tagGroupId?: string;
  defaultTagId?: string;
}

interface RecordRow {
  id?: string;
  data: Record<string, any>;
  isNew?: boolean;
  isDirty?: boolean;
}

type SortDir = 'asc' | 'desc' | null;

function getDefaultValue(col: ColumnDef, _username?: string): any {
  switch (col.defaultBehavior) {
    case 'today':
      return new Date().toISOString().split('T')[0];
    case 'checked':
      return true;
    case 'unchecked':
      return false;
    case 'current_user':
      return _username ?? '';
    default:
      if (col.type === 'currency') return { amount: 0, currency: col.currencyOptions?.[0] ?? 'PLN' };
      if (col.type === 'tag_group') return [];
      if (col.type === 'checkbox') return false;
      return '';
  }
}

function getCellSortValue(data: Record<string, any>, colId: string): string | number {
  const v = data[colId];
  if (v == null) return '';
  if (typeof v === 'object' && 'amount' in v) return Number(v.amount) || 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

const ROWS_PER_PAGE = 50;

export default function ExpensesPage() {
  const { user } = useAuth();
  const [template, setTemplate] = useState<any>(null);
  const [allRecords, setAllRecords] = useState<RecordRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [tagGroups, setTagGroups] = useState<any[]>([]);
  const [tagMappings, setTagMappings] = useState<{ income?: string; expense?: string; planning?: string; costs?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [csvImportOpen, setCSVImportOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ rowIndex: number } | null>(null);
  const hasUnsaved = useRef(false);
  const deletedIdsRef = useRef<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveAllRef = useRef<() => Promise<void>>(async () => {});

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveAllRef.current();
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Filtering, sorting, pagination state
  const [filters, setFilters] = useState<IExpenseFilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const columns: ColumnDef[] = template?.columns ?? [];
  const visibleColumns = columns.filter((c) => !hiddenColumns.has(c.id));

  // Category color map
  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      map[cat.name] = cat.color || '#888';
    }
    return map;
  }, [categories]);

  // Tag color map from tagGroups (tag name → color)
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of tagGroups) {
      for (const tag of group.tags ?? []) {
        map[tag.name] = tag.color || '#888';
      }
    }
    return map;
  }, [tagGroups]);

  // Combined color map: tag_group columns use tagColorMap for row/cell coloring
  const getColorForTag = useCallback((tagName: string) => {
    return tagColorMap[tagName] || categoryColorMap[tagName] || '#888';
  }, [tagColorMap, categoryColorMap]);

  const loadData = useCallback(async () => {
    try {
      const [tmpl, cats, members, tGroups, mappings] = await Promise.all([
        api.getDefaultTemplate(),
        api.getCategories(),
        api.getFamilyMembers().catch(() => []),
        api.getTagGroups().catch(() => []),
        api.getTagMappings().catch(() => ({})),
      ]);
      setTemplate(tmpl);
      setCategories(cats);
      setFamilyMembers(Array.isArray(members) ? members : []);
      setTagGroups(Array.isArray(tGroups) ? tGroups : []);
      setTagMappings(mappings ?? {});

      const result = await api.getRecords(tmpl.id, 1, 500);
      const rows: RecordRow[] = (result.records ?? []).map((r: any) => ({
        id: r.id,
        data: r.data,
      }));
      setAllRecords(rows);
    } catch (e) {
      console.error('Failed to load expenses:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Filtering ────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let result = allRecords;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) =>
        Object.values(r.data).some((v) => {
          if (v == null) return false;
          if (typeof v === 'object' && 'amount' in v) return String(v.amount).includes(q);
          if (Array.isArray(v)) return v.some((s) => String(s).toLowerCase().includes(q));
          return String(v).toLowerCase().includes(q);
        }),
      );
    }

    if (filters.dateFrom) {
      result = result.filter((r) => (r.data.col_date ?? '') >= filters.dateFrom);
    }
    if (filters.dateTo) {
      result = result.filter((r) => (r.data.col_date ?? '') <= filters.dateTo);
    }

    if (filters.category) {
      result = result.filter((r) => {
        const cats: string[] = Array.isArray(r.data.col_category) ? r.data.col_category : [];
        return cats.includes(filters.category);
      });
    }

    if (filters.person) {
      result = result.filter((r) => r.data.col_person === filters.person);
    }

    if (filters.paidStatus === 'PAID') {
      result = result.filter((r) => r.data.col_paid === true);
    } else if (filters.paidStatus === 'UNPAID') {
      result = result.filter((r) => !r.data.col_paid);
    }

    return result;
  }, [allRecords, filters]);

  // ─── Sorting ──────────────────────────────────────
  const sortedRecords = useMemo(() => {
    if (!sortCol || !sortDir) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      const va = getCellSortValue(a.data, sortCol);
      const vb = getCellSortValue(b.data, sortCol);

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }

      const sa = String(va);
      const sb = String(vb);
      return sortDir === 'asc' ? sa.localeCompare(sb, 'pl') : sb.localeCompare(sa, 'pl');
    });
  }, [filteredRecords, sortCol, sortDir]);

  // ─── Pagination ───────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / ROWS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return sortedRecords.slice(start, start + ROWS_PER_PAGE);
  }, [sortedRecords, page]);

  // Keep page in bounds
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = useCallback(
    (colId: string) => {
      if (sortCol === colId) {
        if (sortDir === 'asc') setSortDir('desc');
        else if (sortDir === 'desc') {
          setSortCol(null);
          setSortDir(null);
        }
      } else {
        setSortCol(colId);
        setSortDir('asc');
      }
    },
    [sortCol, sortDir],
  );

  const addRow = useCallback(() => {
    const newData: Record<string, any> = {};
    for (const col of columns) {
      newData[col.id] = getDefaultValue(col, user?.firstName ?? user?.username ?? '');
    }
    setAllRecords((prev) => [...prev, { data: newData, isNew: true, isDirty: true }]);
    hasUnsaved.current = true;
    // Jump to last page
    const newTotal = Math.ceil((allRecords.length + 1) / ROWS_PER_PAGE);
    setPage(newTotal);
  }, [columns, user, allRecords.length]);

  const updateCell = useCallback((globalIndex: number, colId: string, value: any) => {
    setAllRecords((prev) => {
      const copy = [...prev];
      copy[globalIndex] = {
        ...copy[globalIndex],
        data: { ...copy[globalIndex].data, [colId]: value },
        isDirty: true,
      };
      return copy;
    });
    hasUnsaved.current = true;
  }, []);

  const removeRow = useCallback((globalIndex: number) => {
    setAllRecords((prev) => {
      const row = prev[globalIndex];
      if (row?.id) {
        deletedIdsRef.current = [...deletedIdsRef.current, row.id];
      }
      return prev.filter((_, i) => i !== globalIndex);
    });
    hasUnsaved.current = true;
    setDeleteConfirm(null);
    triggerAutoSave();
  }, [triggerAutoSave]);

  const duplicateRow = useCallback(
    (globalIndex: number) => {
      const sourceRow = allRecords[globalIndex];
      if (!sourceRow) return;
      const newData = {
        ...sourceRow.data,
        col_date: new Date().toISOString().split('T')[0],
        col_paid: false,
      };
      setAllRecords((prev) => {
        const copy = [...prev];
        copy.splice(globalIndex + 1, 0, { data: newData, isNew: true, isDirty: true });
        return copy;
      });
      hasUnsaved.current = true;
    },
    [allRecords],
  );

  const showReceipt = useCallback(async (receiptId: string) => {
    setReceiptLoading(true);
    setReceiptDialogOpen(true);
    setReceiptImage(null);
    try {
      const receipt = await api.getReceipt(receiptId);
      setReceiptImage(receipt.imageUrl ?? null);
    } catch {
      setReceiptImage(null);
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  const saveAll = useCallback(async () => {
    if (!template || !hasUnsaved.current) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const toSend = allRecords.map((r, i) => ({
        id: r.id,
        data: r.data,
        sortOrder: i,
      }));
      const deletedIds = deletedIdsRef.current;

      await api.bulkUpdateRecords(template.id, toSend, deletedIds);
      hasUnsaved.current = false;
      deletedIdsRef.current = [];

      const result = await api.getRecords(template.id, 1, 500);
      setAllRecords(
        (result.records ?? []).map((r: any) => ({
          id: r.id,
          data: r.data,
        })),
      );
      window.dispatchEvent(new Event('financio:summary-refresh'));
      setSaveStatus('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('idle');
    } finally {
      setSaving(false);
    }
  }, [allRecords, template]);
  saveAllRef.current = saveAll;

  const exportCSV = useCallback(() => {
    if (!columns.length || !allRecords.length) return;
    const headers = columns.map((c) => c.name);
    const rows = allRecords.map((r) =>
      columns.map((c) => {
        const v = r.data[c.id];
        if (c.type === 'currency' && v?.amount != null) return `${v.amount} ${v.currency ?? 'PLN'}`;
        if (Array.isArray(v)) return v.join(', ');
        return String(v ?? '');
      }),
    );
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${template?.name ?? 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }, [columns, allRecords, template]);

  const handleCSVImport = useCallback(
    async (records: { data: Record<string, any> }[]) => {
      if (!template) return;
      await api.importRecords(
        template.id,
        records.map((r) => ({ data: r.data })),
      );
      await loadData();
    },
    [template, loadData],
  );

  const toggleColumn = useCallback((colId: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  // Find the global index of a paginated row
  const getGlobalIndex = useCallback(
    (row: RecordRow): number => {
      return allRecords.indexOf(row);
    },
    [allRecords],
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Nie znaleziono domyślnego szablonu wydatków.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wydatki</h1>
          <p className="text-sm text-muted-foreground">
            {sortedRecords.length} z {allRecords.length} wpisów
            {sortedRecords.length !== allRecords.length && ' (filtrowane)'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtry
            {filters !== EMPTY_FILTERS &&
              Object.values(filters).some((v) => v !== '' && v !== 'ALL') && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-[10px]">
                  !
                </Badge>
              )}
          </Button>

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="h-4 w-4 mr-1" />
                Kolumny
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={!hiddenColumns.has(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setCSVImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj
          </Button>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Zapisywanie...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-600 dark:text-green-400">✓ Zapisano</span>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <ExpenseFilters
          filters={filters}
          onFiltersChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
          categories={categories}
          familyMembers={familyMembers}
        />
      )}

      {/* Summary */}
      <ExpenseSummary records={sortedRecords} categories={categories} />

      {/* Dynamic Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              {visibleColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className="min-w-[120px] cursor-pointer select-none hover:bg-accent/50 transition-colors"
                  onClick={() => handleSort(col.id)}
                >
                  <span className="flex items-center gap-1">
                    {col.name}
                    {col.required && <span className="text-destructive">*</span>}
                    {sortCol === col.id ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                    )}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8 text-muted-foreground">
                  {allRecords.length === 0
                    ? 'Brak wpisów. Kliknij "Dodaj" aby rozpocząć.'
                    : 'Brak wpisów pasujących do filtrów.'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedRecords.map((row) => {
                const globalIdx = getGlobalIndex(row);
                const rowNum = (page - 1) * ROWS_PER_PAGE + paginatedRecords.indexOf(row) + 1;
                // Row coloring from colorRowByTag column
                const colorRowCol = columns.find(c => c.colorRowByTag);
                let rowBgColor: string | undefined;
                if (colorRowCol) {
                  const rowTags = Array.isArray(row.data[colorRowCol.id]) ? row.data[colorRowCol.id] as string[] : [];
                  const tagColor = rowTags.length > 0 ? getColorForTag(rowTags[0]) : undefined;
                  if (tagColor && tagColor !== '#888') {
                    rowBgColor = `${tagColor}15`;
                  }
                }
                return (
                  <TableRow key={row.id ?? `new-${globalIdx}`} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                    <TableCell className="text-muted-foreground text-xs">{rowNum}</TableCell>
                    {visibleColumns.map((col) => {
                      // Cell coloring from colorFieldByTag
                      let cellBgColor: string | undefined;
                      if (col.colorFieldByTag) {
                        const refTags = Array.isArray(row.data[col.colorFieldByTag]) ? row.data[col.colorFieldByTag] as string[] : [];
                        const tagColor = refTags.length > 0 ? getColorForTag(refTags[0]) : undefined;
                        if (tagColor && tagColor !== '#888') {
                          cellBgColor = `${tagColor}20`;
                        }
                      }
                      return (
                        <TableCell key={col.id} className="p-1" style={cellBgColor ? { backgroundColor: cellBgColor } : undefined}>
                          <CellEditor
                            column={col}
                            value={row.data[col.id]}
                            onChange={(v) => updateCell(globalIdx, col.id, v)}
                            onBlur={triggerAutoSave}
                            categories={categories}
                            familyMembers={familyMembers}
                            categoryColorMap={categoryColorMap}
                            tagGroups={tagGroups}
                            tagColorMap={tagColorMap}
                            tagMappings={tagMappings}
                            rowData={row.data}
                            columns={columns}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell className="p-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => duplicateRow(globalIdx)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplikuj
                          </DropdownMenuItem>
                          {row.data._receiptId && (
                            <DropdownMenuItem onClick={() => showReceipt(row.data._receiptId)}>
                              <Camera className="h-4 w-4 mr-2" /> Pokaż paragon
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirm({ rowIndex: globalIdx })}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Usuń wiersz
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Strona {page} z {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick add at bottom */}
      <Button variant="ghost" size="sm" onClick={addRow} className="w-full border border-dashed">
        <Plus className="h-4 w-4 mr-1" /> Nowy wiersz
      </Button>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wiersz?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten wpis? Zmiana zostanie zapisana automatycznie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && removeRow(deleteConfirm.rowIndex)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt image dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Zdjęcie paragonu
            </DialogTitle>
          </DialogHeader>
          {receiptLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : receiptImage ? (
            <div className="rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptImage}
                alt="Paragon"
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Camera className="h-10 w-10 opacity-30" />
              <p className="text-sm">Zdjęcie paragonu wygasło lub nie jest dostępne</p>
              <p className="text-xs">Zdjęcia paragonów są przechowywane przez 30 dni.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import dialog */}
      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCSVImportOpen}
        columns={columns}
        categories={categories}
        onImport={handleCSVImport}
      />
    </div>
  );
}

// ─── Cell Editor Component ──────────────────────────

function CellEditor({
  column,
  value,
  onChange,
  onBlur,
  categories,
  familyMembers,
  categoryColorMap,
  tagGroups,
  tagColorMap,
  tagMappings,
  rowData,
  columns,
}: {
  column: ColumnDef;
  value: any;
  onChange: (v: any) => void;
  onBlur?: () => void;
  categories: any[];
  familyMembers: any[];
  categoryColorMap: Record<string, string>;
  tagGroups: any[];
  tagColorMap: Record<string, string>;
  tagMappings: { income?: string; expense?: string; planning?: string; costs?: string };
  rowData: Record<string, any>;
  columns: ColumnDef[];
}) {
  switch (column.type) {
    case 'text':
      return (
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-8 text-sm border-0 bg-transparent focus:bg-card"
          placeholder={column.name}
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          onBlur={onBlur}
          className="h-8 text-sm border-0 bg-transparent focus:bg-card"
          placeholder="0"
        />
      );

    case 'date':
      return (
        <Input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-8 text-sm border-0 bg-transparent focus:bg-card"
        />
      );

    case 'checkbox':
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={!!value}
            onCheckedChange={(checked) => { onChange(!!checked); onBlur?.(); }}
          />
        </div>
      );

    case 'select':
      return (
        <Select value={value ?? ''} onValueChange={(v) => { onChange(v); onBlur?.(); }}>
          <SelectTrigger className="h-8 text-sm border-0 bg-transparent">
            <SelectValue placeholder={`Wybierz...`} />
          </SelectTrigger>
          <SelectContent>
            {(column.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'currency': {
      const amount = value?.amount ?? '';
      const currency = value?.currency ?? column.currencyOptions?.[0] ?? 'PLN';
      // Dynamic background based on tag mappings (income/expense)
      // tagMappings values are tag IDs, but record values are tag names — resolve first
      let amountBg: string | undefined;
      if (tagMappings.income || tagMappings.expense) {
        // Build a tag ID → name lookup from tagGroups
        const idToName: Record<string, string> = {};
        for (const group of tagGroups) {
          for (const tag of group.tags ?? []) {
            idToName[tag.id] = tag.name;
          }
        }
        const incomeTagName = tagMappings.income ? idToName[tagMappings.income] : undefined;
        const expenseTagName = tagMappings.expense ? idToName[tagMappings.expense] : undefined;

        const tagGroupCols = columns.filter(c => c.type === 'tag_group');
        for (const tgCol of tagGroupCols) {
          const cellVal = rowData[tgCol.id];
          const selectedValues: string[] = Array.isArray(cellVal) ? cellVal : cellVal ? [cellVal] : [];
          if (incomeTagName && selectedValues.includes(incomeTagName)) {
            amountBg = 'rgba(34, 197, 94, 0.12)';
            break;
          }
          if (expenseTagName && selectedValues.includes(expenseTagName)) {
            amountBg = 'rgba(239, 68, 68, 0.12)';
            break;
          }
        }
      }

      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) =>
              onChange({ amount: e.target.value ? Number(e.target.value) : '', currency })
            }
            onFocus={(e) => {
              if (Number(e.target.value) === 0) {
                onChange({ amount: '', currency });
              }
            }}
            onBlur={onBlur}
            className="h-8 text-sm border-0 flex-1 rounded-md"
            style={amountBg ? { backgroundColor: amountBg } : undefined}
            placeholder="0.00"
          />
          <span className="text-xs text-muted-foreground shrink-0">{currency}</span>
        </div>
      );
    }

    case 'tag_group': {
      const tags: string[] = Array.isArray(value) ? value : [];
      const group = tagGroups.find((g: any) => g.id === column.tagGroupId);
      const availableTags: any[] = group?.tags ?? [];
      const allowMultiple = column.allowMultiple !== false;

      const toggleTag = (tagName: string) => {
        if (tags.includes(tagName)) {
          onChange(tags.filter((t) => t !== tagName));
        } else {
          if (allowMultiple) {
            onChange([...tags, tagName]);
          } else {
            onChange([tagName]);
          }
        }
        if (!allowMultiple) onBlur?.();
      };

      return (
        <Popover onOpenChange={(open) => { if (!open) onBlur?.(); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex flex-wrap gap-1 items-center min-h-[32px] w-full rounded-md px-2 py-1 text-sm border-0 bg-transparent hover:bg-accent/50 cursor-pointer text-left"
            >
              {tags.length === 0 ? (
                <span className="text-muted-foreground text-xs">Wybierz...</span>
              ) : (
                tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs gap-1 pointer-events-none"
                    style={{
                      backgroundColor: tagColorMap[tag] ? `${tagColorMap[tag]}20` : undefined,
                      color: tagColorMap[tag] || undefined,
                      borderColor: tagColorMap[tag] || undefined,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: tagColorMap[tag] || '#888' }}
                    />
                    {tag}
                  </Badge>
                ))
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="start">
            <div className="max-h-48 overflow-y-auto">
              {availableTags.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">Brak tagów w grupie</p>
              ) : (
                availableTags.map((t: any) => {
                  const isSelected = tags.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer text-left ${isSelected ? 'bg-accent/60 font-medium' : ''}`}
                      onClick={() => toggleTag(t.name)}
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color || '#888' }}
                      />
                      <span className="flex-1 truncate">{t.icon ? `${t.icon} ` : ''}{t.name}</span>
                      {isSelected && <span className="text-primary">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    case 'person': {
      const options = familyMembers.map((m: any) => ({
        value: m.nickname || m.user?.firstName || m.user?.username || m.id,
        label: m.nickname || m.user?.firstName || m.user?.username || 'Unknown',
      }));
      return (
        <Select value={value ?? ''} onValueChange={(v) => { onChange(v); onBlur?.(); }}>
          <SelectTrigger className="h-8 text-sm border-0 bg-transparent">
            <SelectValue placeholder="Osoba..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    default:
      return (
        <Input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-8 text-sm border-0 bg-transparent"
        />
      );
  }
}
