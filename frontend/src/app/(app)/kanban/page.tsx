'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, Save, Pencil, Settings } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { useRouter } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */

type KanbanObjectType = 'bill' | 'expense' | 'fixed-expense' | 'receipt';

interface IKanbanColumnConfig {
  id: string;
  name: string;
  tagId: string;
  objectTypes: KanbanObjectType[];
}

interface IKanbanCard {
  id: string;
  objectType: KanbanObjectType;
  objectId: string;
  title: string;
  amount: number;
  currency: string;
  meta?: string;
  cardBgColor?: string;
  amountBgColor?: string;
}

interface IKanbanColumnBoard extends IKanbanColumnConfig {
  tagName?: string | null;
  cards: IKanbanCard[];
}

const OBJECT_TYPE_LABEL: Record<KanbanObjectType, string> = {
  bill: 'Cykliczne wydatki',
  expense: 'Wydatki',
  'fixed-expense': 'Ukryte',
  receipt: 'Paragony',
};

const VISIBLE_OBJECT_TYPES: KanbanObjectType[] = ['bill', 'expense', 'receipt'];

function formatPLN(value: number, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value);
}

export default function KanbanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const [columnsConfig, setColumnsConfig] = useState<IKanbanColumnConfig[]>([]);
  const [boardColumns, setBoardColumns] = useState<IKanbanColumnBoard[]>([]);
  const [tagGroups, setTagGroups] = useState<any[]>([]);

  const [showNewColumn, setShowNewColumn] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnTagId, setNewColumnTagId] = useState('');
  const [newColumnObjectTypes, setNewColumnObjectTypes] = useState<KanbanObjectType[]>(['expense']);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<Record<KanbanObjectType, boolean>>({
    bill: true,
    expense: true,
    'fixed-expense': false,
    receipt: true,
  });

  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);
  const [cardDetailsLoading, setCardDetailsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<IKanbanCard | null>(null);
  const [cardDetailData, setCardDetailData] = useState<Record<string, any> | null>(null);
  const [savingCardDetails, setSavingCardDetails] = useState(false);

  const allTags = useMemo(
    () => tagGroups.flatMap((g: any) => (g.tags ?? []).map((t: any) => ({ ...t, groupName: g.name }))),
    [tagGroups],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [config, board, groups] = await Promise.all([
        api.getKanbanConfig(),
        api.getKanbanBoard(),
        api.getTagGroups(),
      ]);

      const sanitizedConfig = (config.columns ?? []).map((col: IKanbanColumnConfig) => ({
        ...col,
        objectTypes: (col.objectTypes ?? []).filter((t) => t !== 'fixed-expense'),
      }));

      const sanitizedBoard = (board.columns ?? []).map((col: IKanbanColumnBoard) => ({
        ...col,
        objectTypes: (col.objectTypes ?? []).filter((t) => t !== 'fixed-expense'),
        cards: (col.cards ?? []).filter((card) => card.objectType !== 'fixed-expense'),
      }));

      setColumnsConfig(sanitizedConfig);
      setBoardColumns(sanitizedBoard);
      setTagGroups(Array.isArray(groups) ? groups : []);
    } catch (e) {
      console.error('Failed to load kanban', e);
      setColumnsConfig([]);
      setBoardColumns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleType = (type: KanbanObjectType, checked: boolean) => {
    setNewColumnObjectTypes((prev) => {
      if (checked) {
        if (prev.includes(type)) return prev;
        return [...prev, type];
      }
      return prev.filter((x) => x !== type);
    });
  };

  const addColumn = () => {
    if (!newColumnName.trim() || !newColumnTagId || newColumnObjectTypes.length === 0) {
      toastError('Uzupełnij nazwę, tag i co najmniej jeden typ obiektu.');
      return;
    }

    const col: IKanbanColumnConfig = {
      id: `col-${Date.now()}`,
      name: newColumnName.trim(),
      tagId: newColumnTagId,
      objectTypes: newColumnObjectTypes,
    };

    setColumnsConfig((prev) => [...prev, col]);
    setShowNewColumn(false);
    setNewColumnName('');
    setNewColumnTagId('');
    setNewColumnObjectTypes(['expense']);
  };

  const removeColumn = (id: string) => {
    setColumnsConfig((prev) => prev.filter((c) => c.id !== id));
  };

  const updateColumn = (id: string, patch: Partial<IKanbanColumnConfig>) => {
    setColumnsConfig((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const reorderColumns = (fromId: string, toId: string) => {
    setColumnsConfig((prev) => {
      const fromIndex = prev.findIndex((x) => x.id === fromId);
      const toIndex = prev.findIndex((x) => x.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.updateKanbanConfig({ columns: columnsConfig });
      await loadData();
    } catch (e) {
      console.error('Failed to save kanban config', e);
    } finally {
      setSavingConfig(false);
    }
  };

  const onDragStart = (event: React.DragEvent, card: IKanbanCard, fromColumnTagId: string) => {
    event.dataTransfer.setData('application/json', JSON.stringify({
      objectId: card.objectId,
      objectType: card.objectType,
      fromTagId: fromColumnTagId,
      cardId: card.id,
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = async (event: React.DragEvent, toColumnTagId: string) => {
    event.preventDefault();
    try {
      const raw = event.dataTransfer.getData('application/json');
      if (!raw) return;
      const payload = JSON.parse(raw) as {
        objectId: string;
        objectType: KanbanObjectType;
        fromTagId?: string;
        cardId: string;
      };

      if (payload.fromTagId === toColumnTagId) return;

      setMovingCardId(payload.cardId);
      await api.moveKanbanCard({
        objectId: payload.objectId,
        objectType: payload.objectType,
        fromTagId: payload.fromTagId,
        toTagId: toColumnTagId,
      });
      await loadData();
    } catch (e) {
      console.error('Failed to move card', e);
    } finally {
      setMovingCardId(null);
    }
  };

  const filteredBoardColumns = useMemo(() => {
    const enabledTypes = Object.entries(typeFilter)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type as KanbanObjectType);

    return boardColumns.map((col) => ({
      ...col,
      cards: col.cards.filter(
        (card) => card.objectType !== 'fixed-expense' && enabledTypes.includes(card.objectType),
      ),
    }));
  }, [boardColumns, typeFilter]);

  const openCardDetails = async (card: IKanbanCard) => {
    setSelectedCard(card);
    setCardDetailsOpen(true);
    setCardDetailsLoading(true);
    try {
      const details = await api.getKanbanCard(card.objectType, card.objectId);
      setCardDetailData(details?.data ?? null);
    } catch (e) {
      console.error('Failed to load card details', e);
      toastError('Nie udało się pobrać szczegółów karty.');
      setCardDetailsOpen(false);
      setSelectedCard(null);
    } finally {
      setCardDetailsLoading(false);
    }
  };

  const saveCardDetails = async () => {
    if (!selectedCard || !cardDetailData) return;
    setSavingCardDetails(true);
    try {
      await api.updateKanbanCard({
        objectType: selectedCard.objectType,
        objectId: selectedCard.objectId,
        patch: cardDetailData,
      });
      await loadData();
      setCardDetailsOpen(false);
      setSelectedCard(null);
      setCardDetailData(null);
    } catch (e) {
      console.error('Failed to save card details', e);
    } finally {
      setSavingCardDetails(false);
    }
  };

  const gotoSource = () => {
    if (!selectedCard) return;
    if (selectedCard.objectType === 'bill') router.push('/bills');
    else if (selectedCard.objectType === 'receipt') router.push('/receipts');
    else router.push('/expenses');
    setCardDetailsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kanban</h1>
          <p className="text-sm text-muted-foreground">
            Kolumny mapują się na tagi. Przeciągnięcie karty do innej kolumny zmienia tag obiektu.
          </p>
        </div>
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="mr-1 h-4 w-4" /> Konfiguracja
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Konfiguracja Kanban</DialogTitle>
              <DialogDescription>
                Zarządzaj kolumnami, mapowaniem tagów i widocznością typów obiektów.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={showNewColumn} onOpenChange={setShowNewColumn}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" /> Dodaj kolumnę</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nowa kolumna Kanban</DialogTitle>
                      <DialogDescription>
                        Wybierz tag i typy obiektów, które mają wpadać do tej kolumny.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Nazwa kolumny</Label>
                        <Input value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="np. Do opłacenia" />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Tag kolumny</Label>
                        <Select value={newColumnTagId} onValueChange={setNewColumnTagId}>
                          <SelectTrigger><SelectValue placeholder="Wybierz tag" /></SelectTrigger>
                          <SelectContent>
                            {allTags.map((tag: any) => (
                              <SelectItem key={tag.id} value={tag.id}>{tag.name} ({tag.groupName})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Typy obiektów</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {VISIBLE_OBJECT_TYPES.map((type) => (
                            <label key={type} className="flex items-center gap-2 rounded border p-2 text-sm">
                              <Checkbox
                                checked={newColumnObjectTypes.includes(type)}
                                onCheckedChange={(v) => handleToggleType(type, !!v)}
                              />
                              {OBJECT_TYPE_LABEL[type]}
                            </label>
                          ))}
                        </div>
                      </div>

                      <Button className="w-full" onClick={addColumn}>Dodaj kolumnę</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Konfiguracja kolumn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {columnsConfig.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Brak kolumn. Dodaj pierwszą kolumnę Kanban.</p>
                  ) : columnsConfig.map((col) => {
                    const tag = allTags.find((t: any) => t.id === col.tagId);
                    const isEditing = editingColumnId === col.id;
                    return (
                      <div
                        key={col.id}
                        draggable
                        onDragStart={() => setDraggedColumnId(col.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedColumnId && draggedColumnId !== col.id) {
                            reorderColumns(draggedColumnId, col.id);
                          }
                          setDraggedColumnId(null);
                        }}
                        className="rounded border p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {!isEditing ? (
                              <>
                                <p className="text-sm font-medium">{col.name}</p>
                                <p className="text-xs text-muted-foreground">Tag: {tag?.name ?? col.tagId} · {col.objectTypes.map((t) => OBJECT_TYPE_LABEL[t]).join(', ')}</p>
                              </>
                            ) : (
                              <div className="space-y-2">
                                <Input value={col.name} onChange={(e) => updateColumn(col.id, { name: e.target.value })} />
                                <Select value={col.tagId} onValueChange={(v) => updateColumn(col.id, { tagId: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {allTags.map((t: any) => (
                                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.groupName})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="grid grid-cols-2 gap-1">
                                  {VISIBLE_OBJECT_TYPES.map((type) => (
                                    <label key={type} className="flex items-center gap-2 rounded border p-1 text-xs">
                                      <Checkbox
                                        checked={col.objectTypes.includes(type)}
                                        onCheckedChange={(v) => {
                                          const checked = !!v;
                                          const current = col.objectTypes;
                                          if (checked && !current.includes(type)) {
                                            updateColumn(col.id, { objectTypes: [...current, type] });
                                          }
                                          if (!checked) {
                                            const next = current.filter((x) => x !== type);
                                            updateColumn(col.id, { objectTypes: next.length ? next : current });
                                          }
                                        }}
                                      />
                                      {OBJECT_TYPE_LABEL[type]}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingColumnId(isEditing ? null : col.id)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => removeColumn(col.id)}>Usuń</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filtr typów obiektów</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {VISIBLE_OBJECT_TYPES.map((type) => (
                      <label key={type} className="flex items-center gap-2 rounded border p-2 text-sm">
                        <Checkbox
                          checked={typeFilter[type]}
                          onCheckedChange={(v) => setTypeFilter((prev) => ({ ...prev, [type]: !!v }))}
                        />
                        {OBJECT_TYPE_LABEL[type]}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" onClick={saveConfig} disabled={savingConfig}>
                <Save className="mr-1 h-4 w-4" />
                {savingConfig ? 'Zapisywanie...' : 'Zapisz konfigurację'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {filteredBoardColumns.map((column) => (
            <div
              key={column.id}
              className="w-[320px] shrink-0 rounded-lg border bg-card"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, column.tagId)}
            >
              <div className="border-b px-3 py-2">
                <p className="font-semibold text-sm">{column.name}</p>
                <p className="text-xs text-muted-foreground">Tag: {column.tagName ?? column.tagId}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {column.objectTypes.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{OBJECT_TYPE_LABEL[t]}</Badge>)}
                </div>
              </div>

              <div className="space-y-2 p-3 min-h-36">
                {column.cards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Brak kart</p>
                ) : column.cards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, card, column.tagId)}
                    className="cursor-grab rounded border bg-background p-2 active:cursor-grabbing"
                    onClick={() => openCardDetails(card)}
                    style={card.cardBgColor ? { backgroundColor: card.cardBgColor } : undefined}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">{OBJECT_TYPE_LABEL[card.objectType]}</Badge>
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium leading-tight">{card.title}</p>
                    <p
                      className="mt-1 inline-block rounded px-1.5 py-0.5 text-sm text-primary font-semibold"
                      style={card.amountBgColor ? { backgroundColor: card.amountBgColor } : undefined}
                    >
                      {formatPLN(card.amount ?? 0, card.currency || 'PLN')}
                    </p>
                    {card.meta ? <p className="text-xs text-muted-foreground mt-1">{card.meta}</p> : null}
                    {movingCardId === card.id ? <p className="text-[11px] text-muted-foreground mt-1">Przenoszenie...</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {boardColumns.length === 0 ? (
            <div className="w-[320px] shrink-0 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Dodaj kolumny i zapisz konfigurację, aby uruchomić tablicę Kanban.
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={cardDetailsOpen} onOpenChange={setCardDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Szczegóły karty</DialogTitle>
            <DialogDescription>
              Szybka edycja obiektu i przejście do źródła.
            </DialogDescription>
          </DialogHeader>

          {cardDetailsLoading || !selectedCard || !cardDetailData ? (
            <div className="py-4 text-sm text-muted-foreground">Ładowanie...</div>
          ) : (
            <div className="space-y-3">
              {selectedCard.objectType === 'bill' && (
                <>
                  <div><Label>Nazwa</Label><Input value={cardDetailData.name ?? ''} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), name: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Kwota</Label><Input type="number" value={cardDetailData.amount ?? 0} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), amount: Number(e.target.value || 0) }))} /></div>
                    <div><Label>Dzień terminu</Label><Input type="number" min={1} max={31} value={cardDetailData.dueDay ?? 1} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), dueDay: Number(e.target.value || 1) }))} /></div>
                  </div>
                </>
              )}

              {selectedCard.objectType === 'receipt' && (
                <>
                  <div><Label>Opis</Label><Input value={cardDetailData.description ?? ''} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), description: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Kwota</Label><Input type="number" value={cardDetailData.amount ?? 0} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), amount: Number(e.target.value || 0) }))} /></div>
                    <div><Label>Data</Label><Input type="date" value={cardDetailData.date ?? ''} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), date: e.target.value }))} /></div>
                  </div>
                </>
              )}

              {selectedCard.objectType === 'expense' && (
                <>
                  <div><Label>Tytuł</Label><Input value={cardDetailData.title ?? ''} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), title: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Kwota</Label><Input type="number" value={cardDetailData.amount ?? 0} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), amount: Number(e.target.value || 0) }))} /></div>
                    <div><Label>Data</Label><Input type="date" value={cardDetailData.date ?? ''} onChange={(e) => setCardDetailData((p) => ({ ...(p ?? {}), date: e.target.value }))} /></div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={gotoSource}>Przejdź do źródła</Button>
                <Button onClick={saveCardDetails} disabled={savingCardDetails}>{savingCardDetails ? 'Zapisywanie...' : 'Zapisz zmiany'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
