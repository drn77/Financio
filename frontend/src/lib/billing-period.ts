import type { IBillingPeriodConfig, IBillingPeriodInfo } from '@shared/models';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function calculatePeriodBoundaries(
  config: IBillingPeriodConfig,
  referenceDate: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const now = new Date(referenceDate);

  switch (config.type) {
    case 'DAY': {
      const hour = config.resetHour ?? 0;
      const start = new Date(now);
      if (now.getHours() < hour) {
        start.setDate(start.getDate() - 1);
      }
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { periodStart: start, periodEnd: end };
    }

    case 'WEEK': {
      const resetDay = config.resetDayOfWeek ?? 1;
      const currentDay = now.getDay() || 7;
      let diff = currentDay - resetDay;
      if (diff < 0) diff += 7;
      const start = new Date(now);
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { periodStart: start, periodEnd: end };
    }

    case 'MONTH': {
      const resetDay = config.resetDayOfMonth ?? 1;
      const year = now.getFullYear();
      const month = now.getMonth();
      const clampedThisMonth = Math.min(resetDay, daysInMonth(year, month + 1));

      let start: Date;
      if (now.getDate() >= clampedThisMonth) {
        start = new Date(year, month, clampedThisMonth, 0, 0, 0, 0);
      } else {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const clampedPrev = Math.min(resetDay, daysInMonth(prevYear, prevMonth + 1));
        start = new Date(prevYear, prevMonth, clampedPrev, 0, 0, 0, 0);
      }

      const startMonth = start.getMonth();
      const startYear = start.getFullYear();
      const nextMonth = startMonth === 11 ? 0 : startMonth + 1;
      const nextYear = startMonth === 11 ? startYear + 1 : startYear;
      const clampedNext = Math.min(resetDay, daysInMonth(nextYear, nextMonth + 1));
      const end = new Date(nextYear, nextMonth, clampedNext, 0, 0, 0, 0);

      return { periodStart: start, periodEnd: end };
    }

    case 'QUARTER': {
      const resetMonth = (config.resetMonth ?? 1) - 1;
      const resetDay = config.resetDay ?? 1;
      const year = now.getFullYear();

      const quarterStarts: Date[] = [];
      for (let q = 0; q < 4; q++) {
        const m = (resetMonth + q * 3) % 12;
        const y = year + (resetMonth + q * 3 >= 12 ? 1 : 0);
        const clamped = Math.min(resetDay, daysInMonth(y, m + 1));
        quarterStarts.push(new Date(y, m, clamped, 0, 0, 0, 0));
      }
      const prevLastQMonth = (resetMonth + 9) % 12;
      const prevLastQYear = prevLastQMonth > resetMonth ? year - 1 : year;
      quarterStarts.push(new Date(prevLastQYear, prevLastQMonth, Math.min(resetDay, daysInMonth(prevLastQYear, prevLastQMonth + 1)), 0, 0, 0, 0));
      const nextFirstQMonth = resetMonth;
      const nextFirstQYear = year + 1;
      quarterStarts.push(new Date(nextFirstQYear, nextFirstQMonth, Math.min(resetDay, daysInMonth(nextFirstQYear, nextFirstQMonth + 1)), 0, 0, 0, 0));
      quarterStarts.sort((a, b) => a.getTime() - b.getTime());

      for (let i = 0; i < quarterStarts.length - 1; i++) {
        if (now >= quarterStarts[i] && now < quarterStarts[i + 1]) {
          return { periodStart: quarterStarts[i], periodEnd: quarterStarts[i + 1] };
        }
      }
      return { periodStart: quarterStarts[0], periodEnd: quarterStarts[1] };
    }

    case 'HALF_YEAR': {
      const resetMonth = (config.resetMonth ?? 1) - 1;
      const resetDay = config.resetDay ?? 1;
      const year = now.getFullYear();

      const halfStarts: Date[] = [];
      for (let h = -1; h <= 2; h++) {
        const m = (resetMonth + h * 6) % 12;
        const y = year + Math.floor((resetMonth + h * 6) / 12);
        const clamped = Math.min(resetDay, daysInMonth(y, ((m % 12) + 12) % 12 + 1));
        halfStarts.push(new Date(y, ((m % 12) + 12) % 12, clamped, 0, 0, 0, 0));
      }
      halfStarts.sort((a, b) => a.getTime() - b.getTime());

      for (let i = 0; i < halfStarts.length - 1; i++) {
        if (now >= halfStarts[i] && now < halfStarts[i + 1]) {
          return { periodStart: halfStarts[i], periodEnd: halfStarts[i + 1] };
        }
      }
      return { periodStart: halfStarts[0], periodEnd: halfStarts[1] };
    }

    case 'YEAR': {
      const resetMonth = (config.resetMonth ?? 1) - 1;
      const resetDay = config.resetDay ?? 1;
      const year = now.getFullYear();

      const clampedThis = Math.min(resetDay, daysInMonth(year, resetMonth + 1));
      const thisYearReset = new Date(year, resetMonth, clampedThis, 0, 0, 0, 0);

      if (now >= thisYearReset) {
        const nextYear = year + 1;
        const clampedNext = Math.min(resetDay, daysInMonth(nextYear, resetMonth + 1));
        return { periodStart: thisYearReset, periodEnd: new Date(nextYear, resetMonth, clampedNext, 0, 0, 0, 0) };
      } else {
        const prevYear = year - 1;
        const clampedPrev = Math.min(resetDay, daysInMonth(prevYear, resetMonth + 1));
        return { periodStart: new Date(prevYear, resetMonth, clampedPrev, 0, 0, 0, 0), periodEnd: thisYearReset };
      }
    }

    default:
      throw new Error(`Unknown billing period type: ${(config as any).type}`);
  }
}

export function getBillingPeriodInfo(
  config: IBillingPeriodConfig,
  referenceDate: Date = new Date(),
  overrideResetDate?: Date | null,
): IBillingPeriodInfo {
  const { periodStart, periodEnd } = calculatePeriodBoundaries(config, referenceDate);
  const effectiveEnd = overrideResetDate ?? periodEnd;
  const now = referenceDate;

  const totalMs = effectiveEnd.getTime() - periodStart.getTime();
  const elapsedMs = now.getTime() - periodStart.getTime();
  const progress = Math.max(0, Math.min(1, totalMs > 0 ? elapsedMs / totalMs : 0));

  const daysTotal = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: effectiveEnd.toISOString(),
    nextReset: effectiveEnd.toISOString(),
    progress,
    daysTotal,
    daysRemaining,
    isOverridden: !!overrideResetDate,
  };
}

/**
 * Interpolate between red and green in HSL space based on progress (0=start, 1=end).
 * Near start of period (progress close to 0) → green (lots of time left)
 * Near end of period (progress close to 1) → red (little time left)
 */
export function getResetIndicatorColor(progress: number): string {
  // Map: 0 (start) → hue 120 (green), 1 (end) → hue 0 (red)
  const hue = Math.round((1 - progress) * 120);
  return `hsl(${hue}, 70%, 45%)`;
}
