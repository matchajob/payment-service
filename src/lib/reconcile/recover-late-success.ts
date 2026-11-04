import { findCycleParties } from '@/lib/charge-cycle/find-cycle-parties';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { hasLiveCharge } from '@/lib/charges/has-live-charge';
import { recordLateSuccess } from '@/lib/charges/record-late-success';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { dunningCycle } from '@/lib/dunning/dunning-cycle';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';

const REJECTED = 'a past_due subscription rejected the recovery of its late-succeeded charge';

export const recoverLateSuccess = (db: Database, charge: Charge, providerChargeRef: string, now: Date) =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, charge.subscriptionId);
    if (subscription?.status !== SUBSCRIPTION_STATUS.PAST_DUE) return false;
    if (subscription.currentPeriodEnd === null || charge.periodEnd <= subscription.currentPeriodEnd) return false;
    if (await hasLiveCharge(tx, charge.subscriptionId, charge.periodEnd)) return false;
    if (!(await recordLateSuccess(tx, charge.chargeId, providerChargeRef))) return false;

    const parties = await findCycleParties(tx, subscription);
    const result = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef } as const;
    const { event, changes } = dunningCycle.decide({ subscription, charge, result, parties, now });
    const outcome = transition(toState(subscription), event, transitionContextFor(subscription, parties.tenant));
    if (outcome.kind === OUTCOME_KIND.REJECTED) throw new Error(REJECTED);
    await applyTransition(tx, {
      subscription,
      outcome,
      changes,
      customer: parties.customer,
      tenant: parties.tenant,
      occurredAt: now,
    });
    return true;
  });
