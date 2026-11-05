import { BILLING_INTERVAL, type BillingInterval } from '@/lib/subscriptions/billing-interval';
import { instantAt } from '@/lib/time/instant-at';
import { wallClockIn } from '@/lib/time/wall-clock';

const MONTHS_PER_YEAR = 12;
const LAST_DAY_OF_PREVIOUS_MONTH = 0;
const MONTHS_IN_INTERVAL: Record<BillingInterval, number> = {
  [BILLING_INTERVAL.MONTH]: 1,
  [BILLING_INTERVAL.YEAR]: MONTHS_PER_YEAR,
};

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, LAST_DAY_OF_PREVIOUS_MONTH)).getUTCDate();

export const advancePeriod = (
  previousEnd: Date,
  anchorDay: number,
  interval: BillingInterval,
  timeZone: string,
): Date => {
  const wall = wallClockIn(previousEnd, timeZone);
  const totalMonths = wall.monthIndex + MONTHS_IN_INTERVAL[interval];
  const year = wall.year + Math.floor(totalMonths / MONTHS_PER_YEAR);
  const monthIndex = totalMonths % MONTHS_PER_YEAR;
  const day = Math.min(anchorDay, daysInMonth(year, monthIndex));
  return instantAt({ ...wall, year, monthIndex, day }, timeZone);
};

export const startPeriod = (
  activatedAt: Date,
  interval: BillingInterval,
  timeZone: string,
): { periodEnd: Date; anchorDay: number } => {
  const anchorDay = wallClockIn(activatedAt, timeZone).day;
  return { periodEnd: advancePeriod(activatedAt, anchorDay, interval, timeZone), anchorDay };
};
