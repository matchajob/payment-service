import { DAY_MS } from '@/lib/time/day-ms';

const FIRST_RETRY = 1;

export const nextRetryAt = (dunningStartedAt: Date, attempt: number, scheduleDays: readonly number[]): Date | null => {
  const offsetDays = scheduleDays[attempt - FIRST_RETRY];
  return offsetDays === undefined ? null : new Date(dunningStartedAt.getTime() + offsetDays * DAY_MS);
};
