import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { recordChargeResult } from '@/lib/charges/record-charge-result';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';
import type { RenewalParties } from '@/lib/renewal/renewal-start';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import { advancePeriod } from '@/lib/subscriptions/period';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';

const MISSING = 'renewed subscription missing';
const NO_ANCHOR = 'renewed subscription has no anchor day';

export type SettleRenewalInput = { charge: Charge; result: ChargeResult; parties: RenewalParties; now: Date };

export const settleRenewal = (db: Database, { charge, result, parties, now }: SettleRenewalInput) =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, charge.subscriptionId);
    if (subscription === undefined) throw new Error(MISSING);
    if (subscription.anchorDay === null) throw new Error(NO_ANCHOR);
    await recordChargeResult(tx, charge.chargeId, result);

    const succeeded = result.outcome === CHARGE_STATUS.SUCCEEDED;
    const event = succeeded ? LIFECYCLE_EVENT.RENEWAL_SUCCEEDED : LIFECYCLE_EVENT.RENEWAL_FAILED;
    const outcome = transition(toState(subscription), event, transitionContextFor(subscription, parties.tenant));
    if (outcome.kind === OUTCOME_KIND.REJECTED) return;
    await applyTransition(tx, {
      subscription,
      outcome,
      changes: succeeded
        ? { currentPeriodEnd: advancePeriod(charge.periodEnd, subscription.anchorDay, parties.plan.interval) }
        : {},
      customer: parties.customer,
      tenant: parties.tenant,
      occurredAt: now,
    });
  });
