import { nextRetryAt } from '@/lib/dunning/next-retry-at';
import type { TransitionChanges } from '@/lib/subscriptions/apply-transition';

const FIRST_RETRY = 1;

export const restartDunning = (
  failedAt: Date,
  failedAttempt: number,
  scheduleDays: readonly number[],
): TransitionChanges => ({
  dunningStartedAt: failedAt,
  dunningAttempt: failedAttempt,
  dunningAttemptBase: failedAttempt,
  nextRetryAt: nextRetryAt(failedAt, FIRST_RETRY, scheduleDays) ?? failedAt,
});
