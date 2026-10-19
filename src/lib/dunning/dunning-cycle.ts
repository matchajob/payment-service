import type { ChargeCycle } from '@/lib/charge-cycle/charge-cycle';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { findDueRetries } from '@/lib/dunning/find-due-retries';
import { nextRetryAt } from '@/lib/dunning/next-retry-at';
import { NO_RETRIES_YET } from '@/lib/dunning/start-dunning';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';

const NEXT = 1;
const STOPPED = { dunningStartedAt: null, nextRetryAt: null };

export const dunningCycle: ChargeCycle = {
  kind: CHARGE_KIND.RETRY,
  dueEvent: LIFECYCLE_EVENT.RETRY_DUE,
  findDue: findDueRetries,
  isDue: ({ status, nextRetryAt: retryAt }, now) =>
    status === SUBSCRIPTION_STATUS.PAST_DUE && retryAt !== null && retryAt <= now,
  attemptOf: ({ dunningAttempt }) => dunningAttempt + NEXT,
  decide: ({ subscription, charge, result, parties, now }) => {
    if (result.outcome === CHARGE_STATUS.SUCCEEDED)
      return {
        event: LIFECYCLE_EVENT.RETRY_SUCCEEDED,
        changes: {
          currentPeriodEnd: charge.periodEnd,
          dunningAttempt: NO_RETRIES_YET,
          dunningAttemptBase: NO_RETRIES_YET,
          ...STOPPED,
        },
      };
    const next =
      subscription.dunningStartedAt === null
        ? null
        : nextRetryAt(
            subscription.dunningStartedAt,
            charge.attempt + NEXT - subscription.dunningAttemptBase,
            parties.dunningScheduleDays,
          );
    if (next === null)
      return {
        event: LIFECYCLE_EVENT.FINAL_RETRY_FAILED,
        changes: {
          dunningAttempt: charge.attempt,
          ...STOPPED,
          canceledAt: now,
          cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
        },
      };
    return { event: LIFECYCLE_EVENT.RETRY_FAILED, changes: { dunningAttempt: charge.attempt, nextRetryAt: next } };
  },
};
