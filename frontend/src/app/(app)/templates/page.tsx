'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Table2, Trash2, Pencil } from 'lucide-react';
import Link from 'next/link';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { setTemplates([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten szablon?')) return;
    try { await api.deleteTemplate(id); loadTemplates(); } catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Szablony</h1>
          <p className="text-sm text-muted-foreground">Twórz własne szablony tabel z konfigurowalnymi kolumnami</p>
        </div>
        <Link href="/templates/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nowy szablon</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Brak szablonów</p>
        ) : templates.map((tpl) => {
          const columns: any[] = Array.isArray(tpl.columns) ? tpl.columns : [];
          return (
            <Card key={tpl.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-primary" />
                    {tpl.name}
                  </CardTitle>
                  {tpl.isDefault && (
                    <Badge variant="default" className="text-xs gap-1">
                      <Star className="h-3 w-3" /> Domyślny
                    </Badge>
                  )}
                </div>
                {tpl.description && <CardDescription className="text-xs">{tpl.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {columns.map((col: any) => (
                    <Badge key={col.id} variant="outline" className="text-xs">
                      {col.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{columns.length} kolumn</p>
                <div className="flex gap-2">
                  <Link href={`/templates/${tpl.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">
                      <Table2 className="h-3 w-3 mr-1" /> Dane
                    </Button>
                  </Link>
                  <Link href={`/templates/${tpl.id}/edit`}>
                    <Button size="sm" variant="ghost"><Pencil className="h-3 w-3" /></Button>
                  </Link>
                  {!tpl.isDefault && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(tpl.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
