'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, GripVertical, Save, ArrowLeft, Settings2 } from 'lucide-react';
import { Plus } from 'lucide-react';


interface IColumnDef {
  id: string;
  name: string;
  type: string;
  required: boolean;
  width?: number;
  options?: string[];
  defaultBehavior?: string;
  defaultValue?: string;
  currencies?: string[];
  tagGroupId?: string;
  defaultTagId?: string;
}

interface ITagGroup {
  id: string;
  name: string;
  tags: { id: string; name: string; color: string; icon: string | null; imageUrl: string | null }[];
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Tekst' },
  { value: 'number', label: 'Liczba' },
  { value: 'date', label: 'Data' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'select', label: 'Lista wyboru' },
  { value: 'tags', label: 'Tagi' },
  { value: 'tag_group', label: 'Tag grupa' },
  { value: 'currency', label: 'Waluta' },
  { value: 'person', label: 'Osoba' },
];

const DEFAULT_BEHAVIORS = [
  { value: 'empty', label: 'Puste' },
  { value: 'today', label: 'Dzisiejsza data' },
  { value: 'copy_previous', label: 'Kopiuj z poprzedniego' },
  { value: 'last_used', label: 'Ostatnio użyte' },
  { value: 'current_user', label: 'Bieżący użytkownik' },
  { value: 'checked', label: 'Zaznaczone' },
  { value: 'unchecked', label: 'Odznaczone' },
  { value: 'custom_date', label: 'Własna data' },
];

function generateId() {
  return 'col_' + Math.random().toString(36).substr(2, 9);
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [columns, setColumns] = useState<IColumnDef[]>([]);
  const [editingCol, setEditingCol] = useState<IColumnDef | null>(null);
  const [optionsText, setOptionsText] = useState('');
  const [currenciesText, setCurrenciesText] = useState('PLN');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [tagGroups, setTagGroups] = useState<ITagGroup[]>([]);

  const loadTemplate = useCallback(async () => {
    try {
      const tpl = await api.getTemplate(id);
      setName(tpl.name);
      setDescription(tpl.description ?? '');
      setIsDefault(tpl.isDefault ?? false);
      setColumns((tpl.columns as IColumnDef[]) ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);
  useEffect(() => { api.getTagGroups().then((data) => setTagGroups(data as ITagGroup[])).catch(() => {}); }, []);

  const addColumn = () => {
    const newCol: IColumnDef = { id: generateId(), name: '', type: 'text', required: false, defaultBehavior: 'empty' };
    setColumns([...columns, newCol]);
    setEditingCol(newCol);
    setOptionsText('');
    setCurrenciesText('PLN');
  };

  const openEditColumn = (col: IColumnDef) => {
    setEditingCol({ ...col });
    setOptionsText((col.options ?? []).join('\n'));
    setCurrenciesText((col.currencies ?? ['PLN']).join(', '));
  };

  const saveColumnEdit = () => {
    if (!editingCol) return;
    const updated = { ...editingCol };
    if (updated.type === 'select' || updated.type === 'tags') {
      updated.options = optionsText.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (updated.type === 'currency') {
      updated.currencies = currenciesText.split(',').map(s => s.trim()).filter(Boolean);
    }
    setColumns(columns.map(c => c.id === updated.id ? updated : c));
    setEditingCol(null);
  };

  const removeColumn = (colId: string) => setColumns(columns.filter(c => c.id !== colId));

  const moveColumn = (fromIdx: number, toIdx: number) => {
    const arr = [...columns]; const [item] = arr.splice(fromIdx, 1); arr.splice(toIdx, 0, item); setColumns(arr);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); if (dragIdx === null || dragIdx === idx) return; moveColumn(dragIdx, idx); setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const handleSave = async () => {
    if (!name || columns.length === 0) return;
    setSaving(true);
    try {
      await api.updateTemplate(id, {
        name, description: description || undefined, isDefault,
        columns: columns.map((c, i) => ({ ...c, width: c.width ?? 150, sortOrder: i })),
      });
      router.push('/templates');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Edytuj szablon</h1>
          <p className="text-sm text-muted-foreground">Zmień kolumny i ich zachowanie</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div><Label>Nazwa szablonu</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Opis</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} id="isDefault" />
            <Label htmlFor="isDefault" className="text-sm">Domyślny szablon</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Kolumny ({columns.length})</CardTitle>
          <Button size="sm" onClick={addColumn}><Plus className="h-4 w-4 mr-1" /> Dodaj</Button>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Brak kolumn</p>
          ) : (
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={col.id}
                  className={`flex items-center gap-2 p-3 border rounded-md ${dragIdx === idx ? 'bg-accent' : 'hover:bg-accent/50'}`}
                  draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDragEnd={handleDragEnd}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{col.name || '(bez nazwy)'}</span>
                    <Badge variant="outline" className="text-xs">{COLUMN_TYPES.find(t => t.value === col.type)?.label ?? col.type}</Badge>
                    {col.required && <Badge variant="secondary" className="text-xs">wymagane</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditColumn(col)}><Settings2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeColumn(col.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingCol} onOpenChange={(open) => { if (!open) setEditingCol(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCol?.name ? `Edytuj: ${editingCol.name}` : 'Nowa kolumna'}</DialogTitle></DialogHeader>
          {editingCol && (
            <div className="space-y-3">
              <div><Label>Nazwa</Label><Input value={editingCol.name} onChange={(e) => setEditingCol({...editingCol, name: e.target.value})} /></div>
              <div>
                <Label>Typ</Label>
                <Select value={editingCol.type} onValueChange={(v) => setEditingCol({...editingCol, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Szerokość (px)</Label><Input type="number" value={editingCol.width ?? 150} onChange={(e) => setEditingCol({...editingCol, width: Number(e.target.value)})} /></div>
                <div>
                  <Label>Domyślne</Label>
                  <Select value={editingCol.defaultBehavior ?? 'empty'} onValueChange={(v) => setEditingCol({...editingCol, defaultBehavior: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEFAULT_BEHAVIORS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {(editingCol.type === 'select' || editingCol.type === 'tags') && (
                <div><Label>Opcje (linia = opcja)</Label><textarea className="w-full h-24 rounded-md border bg-background px-3 py-2 text-sm" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} /></div>
              )}
              {editingCol.type === 'currency' && (
                <div><Label>Waluty</Label><Input value={currenciesText} onChange={(e) => setCurrenciesText(e.target.value)} /></div>
              )}
              {editingCol.type === 'tag_group' && (
                <div className="space-y-3">
                  <div>
                    <Label>Grupa tagów</Label>
                    {tagGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-1">Brak grup tagów. Utwórz grupy w zakładce Tagi.</p>
                    ) : (
                      <Select
                        value={editingCol.tagGroupId ?? ''}
                        onValueChange={(v) => setEditingCol({ ...editingCol, tagGroupId: v, defaultTagId: undefined })}
                      >
                        <SelectTrigger><SelectValue placeholder="Wybierz grupę tagów" /></SelectTrigger>
                        <SelectContent>
                          {tagGroups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name} ({g.tags.length} tagów)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {editingCol.tagGroupId && (() => {
                    const selectedGroup = tagGroups.find(g => g.id === editingCol.tagGroupId);
                    if (!selectedGroup || selectedGroup.tags.length === 0) return null;
                    return (
                      <div>
                        <Label>Domyślny tag</Label>
                        <Select
                          value={editingCol.defaultTagId ?? '_none'}
                          onValueChange={(v) => setEditingCol({ ...editingCol, defaultTagId: v === '_none' ? undefined : v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Brak (puste)</SelectItem>
                            {selectedGroup.tags.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.icon ? `${t.icon} ` : ''}{t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                </div>
              )}
              {editingCol.type === 'date' && editingCol.defaultBehavior === 'custom_date' && (
                <div>
                  <Label>Domyślna data</Label>
                  <Input type="date" value={editingCol.defaultValue ?? ''} onChange={(e) => setEditingCol({...editingCol, defaultValue: e.target.value})} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox checked={editingCol.required} onCheckedChange={(v) => setEditingCol({...editingCol, required: !!v})} id="editReq" />
                <Label htmlFor="editReq" className="text-sm">Wymagane</Label>
              </div>
              <Button className="w-full" onClick={saveColumnEdit}>Zapisz</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Anuluj</Button>
        <Button onClick={handleSave} disabled={saving || !name || columns.length === 0}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Zapisywanie...' : 'Zapisz'}
        </Button>
      </div>
    </div>
  );
}
