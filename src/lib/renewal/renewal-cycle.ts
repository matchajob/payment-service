import type { ChargeCycle } from '@/lib/charge-cycle/charge-cycle';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { startDunning } from '@/lib/dunning/start-dunning';
import { findDueRenewals } from '@/lib/renewal/find-due-renewals';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { nextPeriodEnd } from '@/lib/subscriptions/next-period-end';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

const RENEWAL_ATTEMPT = 0;

export const renewalCycle: ChargeCycle = {
  dueEvent: LIFECYCLE_EVENT.RENEWAL_DUE,
  findDue: findDueRenewals,
  isDue: ({ status, currentPeriodEnd }, now) =>
    status === SUBSCRIPTION_STATUS.ACTIVE && currentPeriodEnd !== null && currentPeriodEnd <= now,
  attemptOf: () => RENEWAL_ATTEMPT,
  canceledOnDue: (now) => ({ canceledAt: now, cancelReason: CANCEL_REASON.CUSTOMER_REQUEST }),
  decide: ({ subscription, charge, result, parties }) =>
    result.outcome === CHARGE_STATUS.SUCCEEDED
      ? {
          event: LIFECYCLE_EVENT.RENEWAL_SUCCEEDED,
          changes: { currentPeriodEnd: nextPeriodEnd(subscription, charge, parties.plan) },
        }
      : {
          event: LIFECYCLE_EVENT.RENEWAL_FAILED,
          changes: startDunning(charge.attemptedAt, parties.dunningScheduleDays),
        },
};
