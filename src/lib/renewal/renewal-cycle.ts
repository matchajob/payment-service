import type { ChargeCycle } from '@/lib/charge-cycle/charge-cycle';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { startDunning } from '@/lib/dunning/start-dunning';
import { findDueRenewals } from '@/lib/renewal/find-due-renewals';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

const RENEWAL_ATTEMPT = 0;

export const renewalCycle: ChargeCycle = {
  kind: CHARGE_KIND.RENEWAL,
  dueEvent: LIFECYCLE_EVENT.RENEWAL_DUE,
  findDue: findDueRenewals,
  isDue: ({ status, currentPeriodEnd }, now) =>
    status === SUBSCRIPTION_STATUS.ACTIVE && currentPeriodEnd !== null && currentPeriodEnd <= now,
  attemptOf: () => RENEWAL_ATTEMPT,
  canceledOnDue: (now) => ({ canceledAt: now, cancelReason: CANCEL_REASON.CUSTOMER_REQUEST }),
  decide: ({ charge, result, parties, now }) =>
    result.outcome === CHARGE_STATUS.SUCCEEDED
      ? { event: LIFECYCLE_EVENT.RENEWAL_SUCCEEDED, changes: { currentPeriodEnd: charge.periodEnd } }
      : { event: LIFECYCLE_EVENT.RENEWAL_FAILED, changes: startDunning(now, parties.dunningScheduleDays) },
};
