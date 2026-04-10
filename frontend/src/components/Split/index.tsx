'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useSplitSocket } from '@/lib/use-split-socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle, X, Send, Receipt, ChevronDown, ChevronUp,
  Users, CheckCircle2, ArrowRight, Copy, Camera, Archive,
} from 'lucide-react';
import { toastError, toastSuccess, toastInfo } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { SplitReceiptEditor } from './SplitReceiptEditor';
import { SplitSummary } from './SplitSummary';
import type {
  ISplit, ISplitMessage, ISplitParticipant, ISplitReceipt,
  ISplitReceiptItem, ISplitSettlement,
} from '@shared/models';

// ─── Helpers ──────────────────────────────────────────

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function getStoredGuestToken(splitId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`split_guest_${splitId}`);
}

function storeGuestToken(splitId: string, token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`split_guest_${splitId}`, token);
  }
}

// ─── Main Component ──────────────────────────────────

interface Props {
  splitId: string;
  userId?: string;
  onClose?: () => void;
  fullScreen?: boolean;
}

export function SplitWidget({ splitId, userId, onClose, fullScreen }: Props) {
  // ─── hooks ────────────────────────────────────────
  const guestToken = useMemo(() => getStoredGuestToken(splitId), [splitId]);

  // ─── useState ─────────────────────────────────────
  const [split, setSplit] = useState<ISplit | null>(null);
  const [messages, setMessages] = useState<ISplitMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'receipts' | 'summary'>('chat');
  const [showReceiptEditor, setShowReceiptEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── useMemo ──────────────────────────────────────
  const isAdmin = useMemo(() => {
    if (!split || !myParticipantId) return false;
    return split.participants.find((p) => p.id === myParticipantId)?.isAdmin ?? false;
  }, [split, myParticipantId]);

  const mySettled = useMemo(() => {
    if (!split || !myParticipantId) return false;
    return split.participants.find((p) => p.id === myParticipantId)?.isSettled ?? false;
  }, [split, myParticipantId]);

  // ─── WebSocket ────────────────────────────────────
  const { isConnected, sendMessage: wsSendMessage } = useSplitSocket(
    splitId,
    { userId, guestToken: guestToken || undefined },
    {
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
      },
      onReceipt: ({ receipt, message }) => {
        setSplit((prev) => {
          if (!prev) return prev;
          return { ...prev, receipts: [...prev.receipts, receipt] };
        });
        setMessages((prev) => [...prev, message]);
      },
      onReceiptUpdate: (receipt) => {
        setSplit((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            receipts: prev.receipts.map((r) => (r.id === receipt.id ? receipt : r)),
          };
        });
      },
      onClaim: ({ action, splitReceiptItemId, participantId, claim }) => {
        setSplit((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            receipts: prev.receipts.map((r) => ({
              ...r,
              items: r.items.map((item) => {
                if (item.id !== splitReceiptItemId) return item;
                if (action === 'add' && claim) {
                  return { ...item, claims: [...item.claims, claim] };
                }
                if (action === 'remove') {
                  return { ...item, claims: item.claims.filter((c) => c.participantId !== participantId) };
                }
                return item;
              }),
            })),
          };
        });
      },
      onParticipant: ({ type, participant }) => {
        setSplit((prev) => {
          if (!prev) return prev;
          if (type === 'joined') {
            const exists = prev.participants.some((p) => p.id === participant.id);
            if (exists) return prev;
            return { ...prev, participants: [...prev.participants, participant] };
          }
          if (type === 'settled') {
            return {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === participant.id ? { ...p, isSettled: participant.isSettled } : p,
              ),
            };
          }
          return prev;
        });
      },
      onArchived: () => {
        setSplit((prev) => (prev ? { ...prev, status: 'ARCHIVED' } : prev));
        toastInfo('Split został zarchiwizowany — wszyscy się rozliczyli');
      },
      onError: ({ message }) => {
        toastError(message);
      },
    },
  );

  // ─── useEffect ────────────────────────────────────
  useEffect(() => {
    loadSplit();
  }, [splitId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── helpers ──────────────────────────────────────
  const loadSplit = async () => {
    setLoading(true);
    try {
      const data = await api.getSplit(splitId, guestToken || undefined);
      setSplit(data);
      setMessages(data.messages || []);

      // Find my participant ID
      if (userId) {
        const me = data.participants.find((p) => p.userId === userId);
        if (me) setMyParticipantId(me.id);
      } else if (guestToken) {
        // Infer from existing participant data
        const me = data.participants.find((p) => !p.userId && p.isAdmin === false);
        // Could be improved — for now, the backend stores guestToken
        // We rely on the API response not leaking guest tokens
        // The join endpoint returns participantId which we store
        const storedPId = localStorage.getItem(`split_pid_${splitId}`);
        if (storedPId) setMyParticipantId(storedPId);
      }
    } catch {
      toastError('Nie udało się załadować Splita');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    wsSendMessage(text);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyLink = () => {
    if (!split) return;
    const url = `${window.location.origin}/split/${split.inviteCode}`;
    navigator.clipboard.writeText(url);
    toastSuccess('Link skopiowany do schowka');
  };

  const handleSettle = async () => {
    if (!myParticipantId) return;
    try {
      await api.markSplitSettled(splitId, guestToken || undefined);
      toastSuccess('Oznaczono jako rozliczone');
    } catch {
      toastError('Nie udało się oznaczyć jako rozliczone');
    }
  };

  // ─── return ───────────────────────────────────────

  if (loading) {
    return (
      <div className={cn(
        'bg-background flex items-center justify-center',
        fullScreen ? 'h-screen w-full' : 'fixed bottom-4 right-4 z-50 w-96 border rounded-xl shadow-2xl p-6',
      )}>
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!split) return null;

  if (!fullScreen && isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium">{split.name}</span>
        {isConnected && <span className="h-2 w-2 rounded-full bg-green-400" />}
      </button>
    );
  }

  return (
    <div className={cn(
      'bg-background border flex flex-col overflow-hidden',
      fullScreen
        ? 'h-screen w-full max-w-2xl mx-auto'
        : 'fixed bottom-4 right-4 z-50 w-[420px] max-h-[600px] rounded-xl shadow-2xl max-[640px]:inset-0 max-[640px]:w-auto max-[640px]:max-h-none max-[640px]:rounded-none max-[640px]:bottom-0 max-[640px]:right-0',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm truncate">{split.name}</h3>
          {isConnected && <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />}
          {split.status === 'ARCHIVED' && (
            <Badge variant="secondary" className="text-xs"><Archive className="h-3 w-3 mr-1" />Zarchiwizowany</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyLink} title="Kopiuj link zaproszenia">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!fullScreen && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(true)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b text-xs">
        {(['chat', 'receipts', 'summary'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2 text-center transition-colors',
              activeTab === tab ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'chat' && 'Czat'}
            {tab === 'receipts' && 'Paragony'}
            {tab === 'summary' && 'Podsumowanie'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-[300px]">
        {activeTab === 'chat' && (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-2">
                {messages.map((msg) => {
                  const isMe = msg.participantId === myParticipantId;
                  if (msg.type === 'RECEIPT') {
                    const receipt = split.receipts.find((r) => r.id === msg.splitReceiptId);
                    return (
                      <div key={msg.id} className="flex flex-col items-center gap-1 py-1">
                        <Badge variant="outline" className="text-xs gap-1">
                          <Receipt className="h-3 w-3" />
                          {msg.participant.nickname} dodał(a) paragon
                          {receipt?.storeName && ` — ${receipt.storeName}`}
                        </Badge>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                      {!isMe && (
                        <span className="text-[10px] text-muted-foreground pl-1">{msg.participant.nickname}</span>
                      )}
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-3 py-1.5 text-sm break-words',
                          isMe ? 'bg-primary text-primary-foreground' : 'bg-muted',
                        )}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            {split.status === 'ACTIVE' && (
              <div className="border-t p-2 flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setShowReceiptEditor(true)}
                  title="Dodaj paragon"
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Napisz wiadomość…"
                  className="h-9 text-sm"
                />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={!inputText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {activeTab === 'receipts' && (
          <ScrollArea className="flex-1 px-3 py-2">
            <div className="space-y-3">
              {split.receipts.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Brak paragonów</p>
              )}
              {split.receipts.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  participants={split.participants}
                  myParticipantId={myParticipantId}
                  splitId={splitId}
                  guestToken={guestToken}
                  splitStatus={split.status}
                  onUpdate={loadSplit}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'summary' && (
          <SplitSummary
            splitId={splitId}
            split={split}
            myParticipantId={myParticipantId}
            isAdmin={isAdmin}
            guestToken={guestToken}
            onSettle={handleSettle}
            mySettled={mySettled}
          />
        )}
      </div>

      {/* Participants bar */}
      <div className="border-t px-3 py-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{split.participants.length} uczestników</span>
        <span className="mx-1">·</span>
        <div className="flex gap-1 overflow-hidden">
          {split.participants.slice(0, 5).map((p) => (
            <Badge key={p.id} variant={p.isSettled ? 'default' : 'outline'} className="text-[10px] h-5">
              {p.nickname}
              {p.isSettled && <CheckCircle2 className="h-2.5 w-2.5 ml-0.5" />}
            </Badge>
          ))}
          {split.participants.length > 5 && <span>+{split.participants.length - 5}</span>}
        </div>
      </div>

      {/* Receipt editor dialog */}
      {showReceiptEditor && (
        <SplitReceiptEditor
          splitId={splitId}
          participantId={myParticipantId!}
          participants={split.participants}
          guestToken={guestToken}
          onClose={() => setShowReceiptEditor(false)}
          onCreated={() => {
            setShowReceiptEditor(false);
            loadSplit();
          }}
        />
      )}
    </div>
  );
}

// ─── Receipt Card ────────────────────────────────────

interface ReceiptCardProps {
  receipt: ISplitReceipt;
  participants: ISplitParticipant[];
  myParticipantId: string | null;
  splitId: string;
  guestToken: string | null;
  splitStatus: string;
  onUpdate: () => void;
}

function ReceiptCard({ receipt, participants, myParticipantId, splitId, guestToken, splitStatus, onUpdate }: ReceiptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.updateSplitReceipt(splitId, receipt.id, { isConfirmed: true }, guestToken || undefined);
      toastSuccess('Paragon zatwierdzony');
      onUpdate();
    } catch {
      toastError('Nie udało się zatwierdzić paragonu');
    } finally {
      setConfirming(false);
    }
  };

  const handleClaim = async (itemId: string) => {
    try {
      await api.claimSplitItem(splitId, itemId, guestToken || undefined);
    } catch {
      // Already claimed or error handled by API client
    }
  };

  const handleUnclaim = async (itemId: string) => {
    try {
      await api.unclaimSplitItem(splitId, itemId, guestToken || undefined);
    } catch {
      // Error handled by API client
    }
  };

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Receipt className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium truncate block">
              {receipt.storeName || 'Paragon'}
            </span>
            <span className="text-xs text-muted-foreground">
              Zapłacił(a): {receipt.paidBy.nickname} · {receipt.totalAmount?.toFixed(2)} {/* currency */}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {receipt.isConfirmed ? (
            <Badge variant="default" className="text-[10px] h-5">
              <CheckCircle2 className="h-3 w-3 mr-0.5" />OK
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] h-5">Wersja robocza</Badge>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-1.5">
          {receipt.items.map((item) => {
            const myClaim = item.claims.find((c) => c.participantId === myParticipantId);
            const claimerCount = item.claims.length;

            return (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                {splitStatus === 'ACTIVE' && receipt.isConfirmed && (
                  <Checkbox
                    checked={!!myClaim}
                    onCheckedChange={(checked) => {
                      if (checked) handleClaim(item.id);
                      else handleUnclaim(item.id);
                    }}
                    className="h-4 w-4"
                  />
                )}
                <span className="flex-1 truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.quantity > 1 && `${item.quantity}× `}{item.total?.toFixed(2)}
                </span>
                {claimerCount > 0 && (
                  <div className="flex gap-0.5 shrink-0">
                    {item.claims.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-[9px] h-4 px-1">
                        {c.participant.nickname.slice(0, 3)}
                      </Badge>
                    ))}
                    {claimerCount > 1 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1">÷{claimerCount}</Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-between items-center pt-1 border-t text-xs">
            <span className="font-medium">Suma: {receipt.totalAmount?.toFixed(2)}</span>
            {!receipt.isConfirmed && splitStatus === 'ACTIVE' && (
              <Button size="sm" className="h-6 text-xs" onClick={handleConfirm} disabled={confirming}>
                Zatwierdź paragon
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
