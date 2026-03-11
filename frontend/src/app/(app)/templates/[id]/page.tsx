'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Save, Download } from 'lucide-react';
import Link from 'next/link';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface IColumn {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  width?: number;
  options?: string[];
  defaultBehavior?: string;
  currencies?: string[];
}

function CellEditor({ col, value, onChange, categories, members }: {
  col: IColumn; value: any; onChange: (v: any) => void;
  categories: any[]; members: any[];
}) {
  switch (col.type) {
    case 'date':
      return <Input type="date" className="h-8 text-xs" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <Input type="number" className="h-8 text-xs" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'checkbox':
      return <Checkbox checked={!!value} onCheckedChange={(v) => onChange(!!v)} />;
    case 'select':
      return (
        <UISelect value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {(col.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </UISelect>
      );
    case 'currency':
      return (
        <div className="flex gap-1">
          <Input type="number" step="0.01" className="h-8 text-xs flex-1" value={value?.amount ?? ''} onChange={(e) => onChange({ ...value, amount: e.target.value })} />
          <UISelect value={value?.currency ?? 'PLN'} onValueChange={(c) => onChange({ ...value, currency: c })}>
            <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(col.currencies ?? ['PLN']).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </UISelect>
        </div>
      );
    case 'tags':
      return (
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <Badge key={cat.id} variant={Array.isArray(value) && value.includes(cat.name) ? 'default' : 'outline'}
              className="text-xs cursor-pointer"
              onClick={() => {
                const arr = Array.isArray(value) ? [...value] : [];
                if (arr.includes(cat.name)) onChange(arr.filter((t: string) => t !== cat.name));
                else onChange([...arr, cat.name]);
              }}>
              {cat.name}
            </Badge>
          ))}
        </div>
      );
    case 'person':
      return (
        <UISelect value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {members.map((m) => <SelectItem key={m.id} value={m.user?.username ?? m.id}>{m.user?.firstName ?? m.user?.username}</SelectItem>)}
          </SelectContent>
        </UISelect>
      );
    default:
      return <Input className="h-8 text-xs" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function TemplateDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [template, setTemplate] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tpl, recs, cats, mems] = await Promise.all([
        api.getTemplate(id),
        api.getRecords(id),
        api.getCategories(),
        api.getFamilyMembers().catch(() => []),
      ]);
      setTemplate(tpl);
      setRecords(Array.isArray(recs) ? recs.map((r: any) => ({ ...r, _isNew: false })) : (recs as any)?.records?.map((r: any) => ({ ...r, _isNew: false })) ?? []);
      setCategories(Array.isArray(cats) ? cats : []);
      setMembers(Array.isArray(mems) ? mems : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const columns: IColumn[] = template?.columns ?? [];

  const addRow = () => {
    const data: any = {};
    for (const col of columns) {
      switch (col.defaultBehavior) {
        case 'today': data[col.id] = new Date().toISOString().split('T')[0]; break;
        case 'checked': data[col.id] = true; break;
        case 'unchecked': data[col.id] = false; break;
        default: data[col.id] = col.type === 'currency' ? { amount: '', currency: col.currencies?.[0] ?? 'PLN' } : '';
      }
    }
    const newRec = { id: 'new_' + Date.now(), templateId: id, data, sortOrder: records.length, _isNew: true };
    setRecords([...records, newRec]);
    setDirty(new Set(dirty).add(newRec.id));
  };

  const updateCell = (recId: string, colId: string, value: any) => {
    setRecords(records.map(r => r.id === recId ? { ...r, data: { ...r.data, [colId]: value } } : r));
    setDirty(new Set(dirty).add(recId));
  };

  const removeRow = (recId: string) => {
    const rec = records.find(r => r.id === recId);
    if (rec && !rec._isNew) setDeleted([...deleted, recId]);
    setRecords(records.filter(r => r.id !== recId));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const changedRecords = records.filter(r => dirty.has(r.id)).map(r => ({
        id: r._isNew ? undefined : r.id,
        data: r.data,
        sortOrder: r.sortOrder,
      }));
      await api.bulkUpdateRecords(id, changedRecords, deleted);
      setDirty(new Set());
      setDeleted([]);
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const headers = columns.map(c => c.name);
    const rows = records.map(r => columns.map(c => {
      const v = r.data?.[c.id];
      if (c.type === 'currency') return `${v?.amount ?? ''} ${v?.currency ?? ''}`;
      if (Array.isArray(v)) return v.join('; ');
      return v ?? '';
    }));
    const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${template?.name ?? 'data'}.csv`;
    a.click();
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!template) {
    return <div className="text-center py-8 text-muted-foreground">Szablon nie znaleziony</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/templates"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">{records.length} wierszy &middot; {columns.length} kolumn</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Wiersz</Button>
          <Button size="sm" onClick={saveAll} disabled={saving || dirty.size === 0}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
              {columns.map((col) => (
                <th key={col.id} className="p-2 text-left text-xs font-medium text-muted-foreground" style={{ minWidth: col.width ?? 120 }}>
                  {col.name}
                </th>
              ))}
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">Brak wierszy</td></tr>
            ) : records.map((rec, idx) => (
              <tr key={rec.id} className={`border-t ${dirty.has(rec.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                <td className="p-2 text-xs text-muted-foreground">{idx + 1}</td>
                {columns.map((col) => (
                  <td key={col.id} className="p-1">
                    <CellEditor col={col} value={rec.data?.[col.id]} onChange={(v) => updateCell(rec.id, col.id, v)} categories={categories} members={members} />
                  </td>
                ))}
                <td className="p-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(rec.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
