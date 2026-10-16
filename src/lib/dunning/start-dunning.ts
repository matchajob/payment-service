import { nextRetryAt } from '@/lib/dunning/next-retry-at';
import type { TransitionChanges } from '@/lib/subscriptions/apply-transition';

const FIRST_RETRY = 1;
export const NO_RETRIES_YET = 0;

export const startDunning = (failedAt: Date, scheduleDays: readonly number[]): TransitionChanges => ({
  dunningStartedAt: failedAt,
  nextRetryAt: nextRetryAt(failedAt, FIRST_RETRY, scheduleDays) ?? failedAt,
  dunningAttempt: NO_RETRIES_YET,
});
