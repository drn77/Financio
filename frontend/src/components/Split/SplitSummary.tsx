'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { ISplit, ISplitSummary } from '@shared/models';

interface Props {
  splitId: string;
  split: ISplit;
  myParticipantId: string | null;
  isAdmin: boolean;
  guestToken: string | null;
  onSettle: () => void;
  mySettled: boolean;
}

export function SplitSummary({ splitId, split, myParticipantId, isAdmin, guestToken, onSettle, mySettled }: Props) {
  const [summary, setSummary] = useState<ISplitSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [splitId]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await api.getSplitSummary(splitId, guestToken || undefined);
      setSummary(data);
    } catch {
      // May not have summary yet
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await api.generateSplitSummary(splitId, guestToken || undefined);
      setSummary(data);
    } catch {
      toastError('Nie udało się wygenerować podsumowania');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const confirmedReceipts = split.receipts.filter((r) => r.isConfirmed).length;
  const totalReceipts = split.receipts.length;

  return (
    <ScrollArea className="flex-1 px-3 py-3">
      <div className="space-y-4">
        {/* Receipts stats */}
        <div className="text-xs text-muted-foreground text-center">
          Zatwierdzone paragony: {confirmedReceipts}/{totalReceipts}
          {confirmedReceipts < totalReceipts && (
            <span className="text-amber-500 ml-1">(nie wszystkie zatwierdzone)</span>
          )}
        </div>

        {/* Generate button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating || confirmedReceipts === 0}
          >
            {generating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {summary ? 'Przelicz ponownie' : 'Oblicz rozliczenia'}
          </Button>
        </div>

        {/* Settlements */}
        {summary && summary.settlements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kto komu płaci</h4>
            {summary.settlements.map((s, i) => {
              const isMe = s.fromParticipantId === myParticipantId || s.toParticipantId === myParticipantId;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    isMe && 'border-primary/50 bg-primary/5',
                  )}
                >
                  <span className={cn('font-medium', s.fromParticipantId === myParticipantId && 'text-primary')}>
                    {s.fromNickname}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={cn('font-medium', s.toParticipantId === myParticipantId && 'text-primary')}>
                    {s.toNickname}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs font-mono">
                    {s.amount.toFixed(2)} zł
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {summary && summary.settlements.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Wszyscy są rozliczeni — brak przelewów do wykonania!
          </p>
        )}

        {/* Settle button */}
        {split.status === 'ACTIVE' && summary && (
          <div className="flex justify-center pt-2">
            {mySettled ? (
              <Badge variant="default" className="gap-1 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Oznaczyłeś jako rozliczone
              </Badge>
            ) : (
              <Button onClick={onSettle} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Rozliczone — potwierdzam
              </Button>
            )}
          </div>
        )}

        {/* Participants status */}
        {split.status === 'ACTIVE' && summary && (
          <div className="space-y-1 pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status uczestników</h4>
            {split.participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1">
                <span>{p.nickname}</span>
                {p.isSettled ? (
                  <Badge variant="default" className="text-[10px] h-5 gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" />Rozliczone
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5">Oczekuje</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {split.status === 'ARCHIVED' && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Ten split został zarchiwizowany — wszyscy się rozliczyli.
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
