'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Clock, Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getResetIndicatorColor, calculatePeriodBoundaries } from '@/lib/billing-period';
import type { IBillingPeriodConfig, IBillingPeriodInfo } from '@shared/models';

 

interface Props {
  templateId: string;
  billingPeriodConfig: IBillingPeriodConfig;
  onPeriodChange: (periodStart: string, periodEnd: string) => void;
}

const CACHE_KEY_PREFIX = 'financio:billing-period:';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

export function BillingPeriodBar({ templateId, billingPeriodConfig, onPeriodChange }: Props) {
  const [periodInfo, setPeriodInfo] = useState<IBillingPeriodInfo | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = current, -1 = prev, etc.
  const [overrideSaving, setOverrideSaving] = useState(false);

  const cacheKey = `${CACHE_KEY_PREFIX}${templateId}`;

  // Load cached offset on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.offset === 'number') {
          setPeriodOffset(parsed.offset);
        }
      }
    } catch { /* ignore */ }
  }, [cacheKey]);

  // Fetch period info
  const fetchPeriodInfo = useCallback(async () => {
    try {
      const info = await api.getBillingPeriod(templateId);
      if (info) {
        setPeriodInfo(info as IBillingPeriodInfo);
      }
    } catch (e) {
      console.error('Failed to fetch billing period:', e);
    }
  }, [templateId]);

  useEffect(() => {
    fetchPeriodInfo();
  }, [fetchPeriodInfo]);

  // Calculate period boundaries for the selected offset
  useEffect(() => {
    if (!billingPeriodConfig?.type) return;

    const now = new Date();
    let refDate = now;

    if (periodOffset !== 0) {
      // Navigate to past/future periods
      let current = now;
      const steps = Math.abs(periodOffset);
      const direction = periodOffset < 0 ? -1 : 1;

      for (let i = 0; i < steps; i++) {
        const { periodStart, periodEnd } = calculatePeriodBoundaries(billingPeriodConfig, current);
        if (direction < 0) {
          current = new Date(periodStart.getTime() - 1);
        } else {
          current = new Date(periodEnd.getTime() + 1);
        }
      }
      refDate = current;
    }

    const { periodStart, periodEnd } = calculatePeriodBoundaries(billingPeriodConfig, refDate);
    const startStr = periodStart.toISOString().split('T')[0];
    const endStr = periodEnd.toISOString().split('T')[0];

    onPeriodChange(startStr, endStr);

    // Save to cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ offset: periodOffset }));
    } catch { /* ignore */ }
  }, [periodOffset, billingPeriodConfig, onPeriodChange, cacheKey]);

  const handleOverride = async () => {
    if (!overrideDate) return;
    setOverrideSaving(true);
    try {
      await api.overrideBillingPeriodReset(templateId, overrideDate);
      await fetchPeriodInfo();
      setOverrideModalOpen(false);
      setOverrideDate('');
    } catch (e) {
      console.error('Failed to override:', e);
    } finally {
      setOverrideSaving(false);
    }
  };

  const goToCurrent = () => setPeriodOffset(0);
  const goPrev = () => setPeriodOffset((o) => o - 1);
  const goNext = () => setPeriodOffset((o) => Math.min(0, o + 1));

  const progress = periodInfo?.progress ?? 0;
  const indicatorColor = getResetIndicatorColor(progress);

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center">
          {/* Period navigation */}
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center">
              {periodInfo ? (
                <>
                  {formatDateShort(periodInfo.periodStart)} — {formatDateShort(periodInfo.periodEnd)}
                </>
              ) : (
                'Bieżący okres'
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goNext}
              disabled={periodOffset >= 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {periodOffset !== 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={goToCurrent}>
                <RotateCcw className="h-3 w-3" /> Bieżący
              </Button>
            )}
          </div>

          {/* Reset indicator */}
          {periodInfo && periodOffset === 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/50 transition-colors cursor-pointer border"
                style={{ borderColor: indicatorColor, color: indicatorColor }}
                onClick={() => {
                  setOverrideDate('');
                  setOverrideModalOpen(true);
                }}
                title="Kliknij aby zmienić datę resetu"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Reset: {formatDate(periodInfo.nextReset)}</span>
                <span className="text-xs opacity-75">
                  ({periodInfo.daysRemaining}d)
                </span>
              </button>
              {periodInfo.isOverridden && (
                <Badge variant="outline" className="text-xs">
                  zmieniony
                </Badge>
              )}
            </div>
          )}

          {periodOffset !== 0 && (
            <Badge variant="secondary" className="ml-auto">
              <Calendar className="h-3 w-3 mr-1" />
              Przeglądasz historię
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Override modal */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Zmień datę resetu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ta zmiana jest jednorazowa i dotyczy tylko bieżącego okresu. Nie nadpisuje ustawień szablonu.
          </p>
          <div className="space-y-2">
            <Input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>Anuluj</Button>
            <Button onClick={handleOverride} disabled={!overrideDate || overrideSaving}>
              {overrideSaving ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
