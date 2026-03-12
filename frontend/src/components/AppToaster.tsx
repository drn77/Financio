'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { TOAST_EVENT_NAME, type AppToastPayload, type AppToastType } from '@/lib/toast';

interface ToastItem {
  id: number;
  createdAt: number;
  title?: string;
  description: string;
  type: AppToastType;
  durationMs: number;
}

const TYPE_STYLES: Record<AppToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

function ToastIcon({ type }: { type: AppToastType }) {
  if (type === 'success') return <CheckCircle2 className="h-4 w-4 shrink-0" />;
  if (type === 'error') return <XCircle className="h-4 w-4 shrink-0" />;
  return <Info className="h-4 w-4 shrink-0" />;
}

export function AppToaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 1;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<AppToastPayload>;
      if (!custom.detail?.description) return;

      const item: ToastItem = {
        id: nextId++,
        createdAt: Date.now(),
        title: custom.detail.title,
        description: custom.detail.description,
        type: custom.detail.type ?? 'info',
        durationMs: custom.detail.durationMs ?? 3500,
      };

      setItems((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.type === item.type &&
          last.description === item.description &&
          item.createdAt - last.createdAt < 800
        ) {
          return prev;
        }
        return [...prev, item];
      });
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, item.durationMs);
    };

    window.addEventListener(TOAST_EVENT_NAME, handler as EventListener);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler as EventListener);
  }, []);

  const visibleItems = useMemo(() => items.slice(-4), [items]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {visibleItems.map((item) => (
        <div
          key={item.id}
          className={`rounded-md border px-3 py-2 shadow-lg backdrop-blur-sm ${TYPE_STYLES[item.type]}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <ToastIcon type={item.type} />
            <div className="min-w-0">
              {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
              <p className="text-sm leading-snug">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
