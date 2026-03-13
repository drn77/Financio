/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  GripVertical,
  Edit2,
  ImageIcon,
  Palette,
  X,
  Tag,
  Settings,
} from 'lucide-react';
import { toastError } from '@/lib/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ITag {
  id: string;
  tagGroupId: string;
  name: string;
  color: string;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

interface ITagGroup {
  id: string;
  familyId: string;
  name: string;
  createdAt: string;
  tags: ITag[];
}

const PRESET_COLORS = [
  '#2ECC71', '#27AE60', '#3498DB', '#2980B9', '#9B59B6',
  '#8E44AD', '#E74C3C', '#C0392B', '#E67E22', '#D35400',
  '#F1C40F', '#F39C12', '#1ABC9C', '#16A085', '#34495E',
  '#2C3E50', '#95A5A6', '#7F8C8D', '#EC407A', '#AB47BC',
];

const PRESET_ICONS = [
  '🏷️', '⭐', '🔥', '💰', '🏠', '🚗', '🍔', '🎮', '📱', '💊',
  '🎵', '📚', '✈️', '🛒', '💡', '🎁', '🏥', '🎓', '🐾', '⚽',
  '🍕', '☕', '🎬', '💻', '🔧', '🌿', '🎨', '📦', '🧹', '👕',
];

export default function TagsPage() {
  const [groups, setGroups] = useState<ITagGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // New group dialog
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  // Edit group dialog (with tabs: group info + tags)
  const [editingGroup, setEditingGroup] = useState<ITagGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editTab, setEditTab] = useState<string>('group');

  // Delete group confirm
  const [deleteGroup, setDeleteGroup] = useState<ITagGroup | null>(null);

  // Tag editing within the edit dialog
  const [editingTag, setEditingTag] = useState<ITag | null>(null);
  const [tagForm, setTagForm] = useState({ name: '', color: '#2ECC71', icon: '', imageUrl: '' });
  const [savingTag, setSavingTag] = useState(false);
  const [deleteTagInfo, setDeleteTagInfo] = useState<{ groupId: string; tag: ITag } | null>(null);

  // Show/hide tag form in edit dialog
  const [showTagForm, setShowTagForm] = useState(false);

  // Tag mappings
  const [tagMappings, setTagMappings] = useState<{ income?: string; expense?: string; planning?: string; costs?: string; savings?: string }>({});
  const [savingMappings, setSavingMappings] = useState(false);

  // Drag state for tags within edit dialog
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGroups = useCallback(async () => {
    try {
      const data = await api.getTagGroups();
      setGroups(data as ITagGroup[]);
    } catch (err) {
      console.error('Failed to load tag groups', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTagMappings = useCallback(async () => {
    try {
      const data = await api.getTagMappings();
      setTagMappings(data);
    } catch (err) {
      console.error('Failed to load tag mappings', err);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    loadTagMappings();
  }, [loadGroups, loadTagMappings]);

  // Keep editingGroup in sync with groups after reload
  useEffect(() => {
    if (editingGroup) {
      const updated = groups.find((g) => g.id === editingGroup.id);
      if (updated) setEditingGroup(updated);
    }
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Group CRUD ---

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setSavingGroup(true);
    try {
      await api.createTagGroup({ name: newGroupName.trim() });
      setNewGroupName('');
      setShowNewGroup(false);
      await loadGroups();
    } catch (err: any) {
      toastError(err.message || 'Błąd');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !editGroupName.trim()) return;
    try {
      await api.updateTagGroup(editingGroup.id, { name: editGroupName.trim() });
      await loadGroups();
    } catch (err: any) {
      toastError(err.message || 'Błąd');
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroup) return;
    try {
      await api.deleteTagGroup(deleteGroup.id);
      setDeleteGroup(null);
      await loadGroups();
    } catch (err: any) {
      toastError(err.message || 'Błąd');
    }
  };

  const openEditDialog = (group: ITagGroup) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditTab('group');
    resetTagForm();
  };

  // --- Tag CRUD (inside edit dialog) ---

  const resetTagForm = () => {
    setEditingTag(null);
    setTagForm({ name: '', color: '#2ECC71', icon: '', imageUrl: '' });
    setShowTagForm(false);
  };

  const startEditTag = (tag: ITag) => {
    if (editingTag?.id === tag.id) {
      resetTagForm();
      return;
    }
    setEditingTag(tag);
    setTagForm({
      name: tag.name,
      color: tag.color,
      icon: tag.icon || '',
      imageUrl: tag.imageUrl || '',
    });
    setShowTagForm(false);
  };

  const handleSaveTag = async () => {
    if (!editingGroup || !tagForm.name.trim()) return;
    setSavingTag(true);
    try {
      const payload: any = {
        name: tagForm.name.trim(),
        color: tagForm.color,
        icon: tagForm.icon || null,
        imageUrl: tagForm.imageUrl || null,
      };

      if (editingTag) {
        await api.updateTag(editingGroup.id, editingTag.id, payload);
      } else {
        payload.sortOrder = editingGroup.tags.length > 0
          ? Math.max(...editingGroup.tags.map((t) => t.sortOrder)) + 1
          : 0;
        await api.createTag(editingGroup.id, payload);
      }
      resetTagForm();
      await loadGroups();
    } catch (err: any) {
      toastError(err.message || 'Błąd');
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!deleteTagInfo) return;
    try {
      await api.deleteTag(deleteTagInfo.groupId, deleteTagInfo.tag.id);
      setDeleteTagInfo(null);
      resetTagForm();
      await loadGroups();
    } catch (err: any) {
      toastError(err.message || 'Błąd');
    }
  };

  // --- Drag & Drop (tags in edit dialog) ---

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx || !editingGroup) return;
    const newTags = [...editingGroup.tags];
    const [moved] = newTags.splice(dragIdx, 1);
    newTags.splice(idx, 0, moved);
    setEditingGroup({ ...editingGroup, tags: newTags });
    setDragIdx(idx);
  };

  const handleDragEnd = async () => {
    setDragIdx(null);
    if (!editingGroup) return;
    const reorderedTags = editingGroup.tags.map((t, i) => ({ id: t.id, sortOrder: i }));
    try {
      await api.reorderTags(editingGroup.id, reorderedTags);
      await loadGroups();
    } catch (err) {
      console.error('Failed to reorder', err);
      await loadGroups();
    }
  };

  // --- Image handling ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toastError('Plik za duży (max 512KB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTagForm((prev) => ({ ...prev, imageUrl: reader.result as string, icon: '' }));
    };
    reader.readAsDataURL(file);
  };

  // --- Tag Mappings ---

  const allTags = groups.flatMap((g) => g.tags.map((t) => ({ ...t, groupName: g.name })));

  const handleMappingChange = async (key: 'income' | 'expense' | 'planning' | 'costs' | 'savings', tagId: string) => {
    const updated = { ...tagMappings, [key]: tagId || undefined };
    if (!tagId) delete updated[key];
    setTagMappings(updated);
    setSavingMappings(true);
    try {
      await api.updateTagMappings(updated);
    } catch (err) {
      console.error('Failed to save tag mappings', err);
    } finally {
      setSavingMappings(false);
    }
  };

  // --- Helpers ---

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tagi</h1>
          <p className="text-muted-foreground text-sm">Zarządzaj grupami tagów i tagami</p>
        </div>
        <Button onClick={() => setShowNewGroup(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nowa grupa
        </Button>
      </div>

      {/* Table */}
      {groups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border rounded-lg">
          <div className="text-center py-16">
            <Tag className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nie masz jeszcze żadnych grup tagów.</p>
            <p className="text-muted-foreground text-sm mb-4">Utwórz pierwszą grupę, aby rozpocząć.</p>
            <Button onClick={() => setShowNewGroup(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nowa grupa
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-52">Nazwa</TableHead>
                <TableHead className="w-44">Czas dodania</TableHead>
                <TableHead>Tagi</TableHead>
                <TableHead className="w-24 text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(group.createdAt)}
                  </TableCell>
                  <TableCell>
                    {group.tags.length === 0 ? (
                      <span className="text-muted-foreground text-sm italic">Brak tagów</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {group.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="gap-1 pl-1.5 pr-2 py-0.5"
                          >
                            {tag.imageUrl ? (
                              <img
                                src={tag.imageUrl}
                                alt={tag.name}
                                className="h-4 w-4 rounded-full object-cover"
                              />
                            ) : tag.icon ? (
                              <span className="text-xs">{tag.icon}</span>
                            ) : (
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                            )}
                            <span className="text-xs">{tag.name}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edytuj"
                        onClick={() => openEditDialog(group)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Usuń"
                        onClick={() => setDeleteGroup(group)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tag Mapping Configurator */}
      {groups.length > 0 && allTags.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Mapowanie tagów
            </CardTitle>
            <CardDescription>
              Przypisz tagi do funkcji aplikacji — np. który tag oznacza przychód, wydatek lub planowanie.
              Na tej podstawie kwoty będą kolorowane automatycznie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {([
                { key: 'income' as const, label: 'Przychód', color: 'text-green-600 dark:text-green-400' },
                { key: 'expense' as const, label: 'Wydatek', color: 'text-red-600 dark:text-red-400' },
                { key: 'planning' as const, label: 'Planowanie', color: 'text-blue-600 dark:text-blue-400' },
                { key: 'costs' as const, label: 'Koszty podatkowe', color: 'text-amber-600 dark:text-amber-400' },
                { key: 'savings' as const, label: 'Oszczędności', color: 'text-emerald-600 dark:text-emerald-400' },
              ]).map(({ key, label, color }) => (
                <div key={key} className="space-y-1.5">
                  <Label className={`text-sm font-medium ${color}`}>{label}</Label>
                  <Select
                    value={tagMappings[key] ?? '__none__'}
                    onValueChange={(val) => handleMappingChange(key, val === '__none__' ? '' : val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Brak" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Brak</SelectItem>
                      {allTags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <span className="flex items-center gap-2">
                            {tag.imageUrl ? (
                              <img src={tag.imageUrl} alt={tag.name} className="h-4 w-4 rounded-full object-cover" />
                            ) : tag.icon ? (
                              <span className="text-xs">{tag.icon}</span>
                            ) : (
                              <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                            )}
                            <span>{tag.name}</span>
                            <span className="text-muted-foreground text-xs">({tag.groupName})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {savingMappings && (
              <p className="text-xs text-muted-foreground mt-2">Zapisywanie...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Group Dialog */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-sm min-h-75 flex flex-col">
          <DialogHeader>
            <DialogTitle>Nowa grupa tagów</DialogTitle>
          </DialogHeader>
          <div className="flex-1">
            <Label>Nazwa grupy</Label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="np. Status, Priorytet, Typ..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
          </div>
          <div className="mt-auto pt-4">
            <Button className="w-full" onClick={handleCreateGroup} disabled={savingGroup || !newGroupName.trim()}>
              {savingGroup ? 'Tworzenie...' : 'Utwórz'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog (with Tabs) */}
      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGroup(null);
            resetTagForm();
          }
        }}
      >
        <DialogContent className="max-w-lg min-h-75 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edycja: {editingGroup?.name}</DialogTitle>
          </DialogHeader>

          <Tabs value={editTab} onValueChange={setEditTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full">
              <TabsTrigger value="group" className="flex-1">Grupa</TabsTrigger>
              <TabsTrigger value="tags" className="flex-1">
                Tagi ({editingGroup?.tags.length ?? 0})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Group Info */}
            <TabsContent value="group" className="flex-1 flex flex-col mt-4">
              <div className="flex-1">
                <Label>Nazwa grupy</Label>
                <Input
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup()}
                />
              </div>
              <div className="mt-auto pt-4">
                <Button className="w-full" onClick={handleUpdateGroup} disabled={!editGroupName.trim()}>
                  Zapisz nazwę
                </Button>
              </div>
            </TabsContent>

            {/* Tab: Tags */}
            <TabsContent value="tags" className="flex-1 flex flex-col overflow-hidden mt-4 gap-3">
              {/* Tag list */}
              <div className="flex-1 overflow-auto space-y-1.5 min-h-0">
                {editingGroup && editingGroup.tags.length === 0 && !showTagForm && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Brak tagów w tej grupie.
                  </div>
                )}
                {editingGroup?.tags.map((tag, idx) => {
                  const isEditing = editingTag?.id === tag.id;
                  return (
                    <div key={tag.id}>
                      {/* Tag row */}
                      <div
                        className={`flex items-center gap-2 p-2 border transition-all ${
                          dragIdx === idx ? 'bg-accent' : ''
                        } ${isEditing
                          ? 'rounded-t-md border-b-transparent bg-muted/80 border-muted-foreground/30'
                          : 'rounded-md hover:bg-accent/50'
                        }`}
                        draggable={!isEditing}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />

                        {tag.imageUrl ? (
                          <img src={tag.imageUrl} alt={tag.name} className="h-6 w-6 rounded-full object-cover shrink-0" />
                        ) : tag.icon ? (
                          <span className="text-lg shrink-0 w-6 text-center">{tag.icon}</span>
                        ) : (
                          <div className="h-6 w-6 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        )}

                        <span className="flex-1 text-sm font-medium truncate">{tag.name}</span>

                        <div className="h-4 w-4 rounded-full border shrink-0" style={{ backgroundColor: tag.color }} title={tag.color} />

                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 shrink-0 ${isEditing ? 'bg-muted-foreground/20' : ''}`}
                          onClick={() => startEditTag(tag)}
                        >
                          {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => setDeleteTagInfo({ groupId: editingGroup!.id, tag })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Inline edit form */}
                      {isEditing && (
                        <div className="animate-expand-down border-x border-b border-muted-foreground/30 rounded-b-md -mt-px">
                          <div className="p-3 space-y-3 bg-muted/30">
                            {/* Name */}
                            <div>
                              <Label className="text-xs">Nazwa</Label>
                              <Input
                                value={tagForm.name}
                                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                                placeholder="np. Pilne, Ważne, Jedzenie..."
                                className="h-8 text-sm"
                              />
                            </div>

                            {/* Color */}
                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <Palette className="h-3 w-3" /> Kolor
                              </Label>
                              <div className="flex flex-wrap gap-1">
                                {PRESET_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                                      tagForm.color === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50'
                                    }`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setTagForm({ ...tagForm, color: c })}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Input
                                  type="color"
                                  value={tagForm.color}
                                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                                  className="w-8 h-7 p-0.5"
                                />
                                <Input
                                  value={tagForm.color}
                                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                                  className="w-24 font-mono text-xs h-7"
                                  placeholder="#RRGGBB"
                                />
                              </div>
                            </div>

                            {/* Icon */}
                            <div>
                              <Label className="text-xs">Ikona (emoji)</Label>
                              <div className="flex flex-wrap gap-1">
                                {PRESET_ICONS.map((ic) => (
                                  <button
                                    key={ic}
                                    className={`h-7 w-7 rounded-md border text-base flex items-center justify-center transition-all ${
                                      tagForm.icon === ic ? 'border-foreground bg-accent' : 'border-transparent hover:border-muted-foreground/50 hover:bg-accent/50'
                                    }`}
                                    onClick={() => setTagForm({ ...tagForm, icon: ic, imageUrl: '' })}
                                  >
                                    {ic}
                                  </button>
                                ))}
                              </div>
                              {tagForm.icon && (
                                <Button variant="ghost" size="sm" className="mt-1 text-xs text-muted-foreground h-6" onClick={() => setTagForm({ ...tagForm, icon: '' })}>
                                  <X className="h-3 w-3 mr-1" /> Usuń ikonę
                                </Button>
                              )}
                            </div>

                            {/* Image */}
                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" /> Zdjęcie (zamiast ikony)
                              </Label>
                              <div className="flex items-center gap-2">
                                {tagForm.imageUrl && (
                                  <div className="relative">
                                    <img src={tagForm.imageUrl} alt="tag" className="h-10 w-10 rounded-lg object-cover border" />
                                    <button
                                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                                      onClick={() => setTagForm({ ...tagForm, imageUrl: '' })}
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                )}
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                                  <ImageIcon className="h-3 w-3 mr-1" />
                                  {tagForm.imageUrl ? 'Zmień' : 'Dodaj zdjęcie'}
                                </Button>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                              </div>
                            </div>

                            {/* Preview */}
                            <div className="flex items-center gap-2 p-2 border rounded-md bg-accent/30">
                              {tagForm.imageUrl ? (
                                <img src={tagForm.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                              ) : tagForm.icon ? (
                                <span className="text-sm w-5 text-center">{tagForm.icon}</span>
                              ) : (
                                <div className="h-5 w-5 rounded-full" style={{ backgroundColor: tagForm.color }} />
                              )}
                              <span className="text-sm font-medium flex-1">{tagForm.name || '(podgląd)'}</span>
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tagForm.color }} />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button className="flex-1 h-8 text-sm" onClick={handleSaveTag} disabled={savingTag || !tagForm.name.trim()}>
                                {savingTag ? 'Zapisywanie...' : 'Zapisz zmiany'}
                              </Button>
                              <Button variant="ghost" className="h-8 text-sm" onClick={resetTagForm}>
                                Anuluj
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add new tag dashed button */}
                {!editingTag && !showTagForm && (
                  <button
                    className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    onClick={() => { resetTagForm(); setShowTagForm(true); }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Dodaj tag</span>
                  </button>
                )}

                {/* New tag form */}
                {showTagForm && !editingTag && (
                  <div className="animate-expand-down border rounded-lg">
                    <div className="p-3 space-y-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold mb-0!">Nowy tag</Label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetTagForm}>
                          <X className="h-3 w-3 mr-1" /> Zamknij
                        </Button>
                      </div>

                      {/* Name */}
                      <div>
                        <Label className="text-xs">Nazwa</Label>
                        <Input
                          value={tagForm.name}
                          onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                          placeholder="np. Pilne, Ważne, Jedzenie..."
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Color */}
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <Palette className="h-3 w-3" /> Kolor
                        </Label>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              className={`h-6 w-6 rounded-full border-2 transition-all ${
                                tagForm.color === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50'
                              }`}
                              style={{ backgroundColor: c }}
                              onClick={() => setTagForm({ ...tagForm, color: c })}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Input
                            type="color"
                            value={tagForm.color}
                            onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                            className="w-8 h-7 p-0.5"
                          />
                          <Input
                            value={tagForm.color}
                            onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                            className="w-24 font-mono text-xs h-7"
                            placeholder="#RRGGBB"
                          />
                        </div>
                      </div>

                      {/* Icon */}
                      <div>
                        <Label className="text-xs">Ikona (emoji)</Label>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_ICONS.map((ic) => (
                            <button
                              key={ic}
                              className={`h-7 w-7 rounded-md border text-base flex items-center justify-center transition-all ${
                                tagForm.icon === ic ? 'border-foreground bg-accent' : 'border-transparent hover:border-muted-foreground/50 hover:bg-accent/50'
                              }`}
                              onClick={() => setTagForm({ ...tagForm, icon: ic, imageUrl: '' })}
                            >
                              {ic}
                            </button>
                          ))}
                        </div>
                        {tagForm.icon && (
                          <Button variant="ghost" size="sm" className="mt-1 text-xs text-muted-foreground h-6" onClick={() => setTagForm({ ...tagForm, icon: '' })}>
                            <X className="h-3 w-3 mr-1" /> Usuń ikonę
                          </Button>
                        )}
                      </div>

                      {/* Image */}
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" /> Zdjęcie (zamiast ikony)
                        </Label>
                        <div className="flex items-center gap-2">
                          {tagForm.imageUrl && (
                            <div className="relative">
                              <img src={tagForm.imageUrl} alt="tag" className="h-10 w-10 rounded-lg object-cover border" />
                              <button
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                                onClick={() => setTagForm({ ...tagForm, imageUrl: '' })}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )}
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {tagForm.imageUrl ? 'Zmień' : 'Dodaj zdjęcie'}
                          </Button>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-accent/30">
                        {tagForm.imageUrl ? (
                          <img src={tagForm.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : tagForm.icon ? (
                          <span className="text-sm w-5 text-center">{tagForm.icon}</span>
                        ) : (
                          <div className="h-5 w-5 rounded-full" style={{ backgroundColor: tagForm.color }} />
                        )}
                        <span className="text-sm font-medium flex-1">{tagForm.name || '(podgląd)'}</span>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tagForm.color }} />
                      </div>

                      {/* Save */}
                      <Button className="w-full h-8 text-sm" onClick={handleSaveTag} disabled={savingTag || !tagForm.name.trim()}>
                        {savingTag ? 'Zapisywanie...' : 'Dodaj tag'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirm */}
      <AlertDialog open={!!deleteGroup} onOpenChange={(open) => { if (!open) setDeleteGroup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć grupę &quot;{deleteGroup?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Wszystkie tagi w tej grupie zostaną usunięte. Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Tag Confirm */}
      <AlertDialog open={!!deleteTagInfo} onOpenChange={(open) => { if (!open) setDeleteTagInfo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć tag &quot;{deleteTagInfo?.tag.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
