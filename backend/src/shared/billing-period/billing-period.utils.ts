export type BillingPeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'HALF_YEAR' | 'YEAR';

export interface IBillingPeriodConfig {
  type: BillingPeriodType;
  resetHour?: number;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  resetMonth?: number;
  resetDay?: number;
  budgetAmount?: number;
}

export interface IBillingPeriodInfo {
  periodStart: string;
  periodEnd: string;
  nextReset: string;
  progress: number;
  daysTotal: number;
  daysRemaining: number;
  isOverridden: boolean;
}

/**
 * Clamp a day-of-month to the max days in the given month/year.
 */
function clampDay(day: number, month: number, year: number): number {
  const maxDays = new Date(year, month, 0).getDate(); // month is 1-based here, Date(y,m,0) gives last day of month m-1... we need different approach
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(day, lastDay);
}

/**
 * Get the number of days in a month (1-indexed month).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate the current billing period boundaries based on config and a reference date.
 * Returns { periodStart, periodEnd } as Date objects.
 */
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
      const resetDay = config.resetDayOfWeek ?? 1; // 1=Monday
      const currentDay = now.getDay() || 7; // Convert Sunday=0 to 7
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
      const month = now.getMonth(); // 0-based

      // Clamp resetDay to actual days in current month
      const clampedThisMonth = Math.min(resetDay, daysInMonth(year, month + 1));

      let start: Date;
      if (now.getDate() >= clampedThisMonth) {
        // We're past reset day this month → period started this month
        start = new Date(year, month, clampedThisMonth, 0, 0, 0, 0);
      } else {
        // We're before reset day → period started last month
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const clampedPrev = Math.min(resetDay, daysInMonth(prevYear, prevMonth + 1));
        start = new Date(prevYear, prevMonth, clampedPrev, 0, 0, 0, 0);
      }

      // End = next reset
      const startMonth = start.getMonth();
      const startYear = start.getFullYear();
      const nextMonth = startMonth === 11 ? 0 : startMonth + 1;
      const nextYear = startMonth === 11 ? startYear + 1 : startYear;
      const clampedNext = Math.min(resetDay, daysInMonth(nextYear, nextMonth + 1));
      const end = new Date(nextYear, nextMonth, clampedNext, 0, 0, 0, 0);

      return { periodStart: start, periodEnd: end };
    }

    case 'QUARTER': {
      const resetMonth = (config.resetMonth ?? 1) - 1; // Convert to 0-based
      const resetDay = config.resetDay ?? 1;
      const year = now.getFullYear();

      // Quarter start months based on resetMonth
      const quarterStarts: Date[] = [];
      for (let q = 0; q < 4; q++) {
        const m = (resetMonth + q * 3) % 12;
        const y = year + (resetMonth + q * 3 >= 12 ? 1 : 0);
        const clamped = Math.min(resetDay, daysInMonth(y, m + 1));
        quarterStarts.push(new Date(y, m, clamped, 0, 0, 0, 0));
      }
      // Also add previous year's last quarter and next year's first
      const prevLastQMonth = (resetMonth + 9) % 12;
      const prevLastQYear = prevLastQMonth > resetMonth ? year - 1 : year;
      quarterStarts.push(new Date(prevLastQYear, prevLastQMonth, Math.min(resetDay, daysInMonth(prevLastQYear, prevLastQMonth + 1)), 0, 0, 0, 0));
      // Next year first quarter
      const nextFirstQMonth = resetMonth;
      const nextFirstQYear = year + 1;
      quarterStarts.push(new Date(nextFirstQYear, nextFirstQMonth, Math.min(resetDay, daysInMonth(nextFirstQYear, nextFirstQMonth + 1)), 0, 0, 0, 0));

      quarterStarts.sort((a, b) => a.getTime() - b.getTime());

      // Find the period that contains `now`
      for (let i = 0; i < quarterStarts.length - 1; i++) {
        if (now >= quarterStarts[i] && now < quarterStarts[i + 1]) {
          return { periodStart: quarterStarts[i], periodEnd: quarterStarts[i + 1] };
        }
      }
      // Fallback
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

      let start: Date;
      let end: Date;
      if (now >= thisYearReset) {
        start = thisYearReset;
        const nextYear = year + 1;
        const clampedNext = Math.min(resetDay, daysInMonth(nextYear, resetMonth + 1));
        end = new Date(nextYear, resetMonth, clampedNext, 0, 0, 0, 0);
      } else {
        const prevYear = year - 1;
        const clampedPrev = Math.min(resetDay, daysInMonth(prevYear, resetMonth + 1));
        start = new Date(prevYear, resetMonth, clampedPrev, 0, 0, 0, 0);
        end = thisYearReset;
      }
      return { periodStart: start, periodEnd: end };
    }

    default:
      throw new Error(`Unknown billing period type: ${(config as any).type}`);
  }
}

/**
 * Get full billing period info including progress and days remaining.
 */
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
 * Generate N past periods for history view.
 */
export function getPastPeriods(
  config: IBillingPeriodConfig,
  count: number,
  referenceDate: Date = new Date(),
): { periodStart: Date; periodEnd: Date }[] {
  const periods: { periodStart: Date; periodEnd: Date }[] = [];
  let current = new Date(referenceDate);

  for (let i = 0; i < count; i++) {
    const { periodStart, periodEnd } = calculatePeriodBoundaries(config, current);
    periods.push({ periodStart, periodEnd });
    // Move reference to 1ms before period start to get previous period
    current = new Date(periodStart.getTime() - 1);
  }

  return periods;
}
