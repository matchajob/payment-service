import type { CycleParties, CycleDecide } from '@/lib/charge-cycle/charge-cycle';
import { recordChargeResult } from '@/lib/charges/record-charge-result';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';

const MISSING = 'charged subscription missing';

export type SettleCycleInput = { charge: Charge; result: ChargeResult; parties: CycleParties; now: Date };

export const settleCycleCharge = (
  decide: CycleDecide,
  db: Database,
  { charge, result, parties, now }: SettleCycleInput,
) =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, charge.subscriptionId);
    if (subscription === undefined) throw new Error(MISSING);
    if (!(await recordChargeResult(tx, charge.chargeId, result))) return false;

    const { event, changes } = decide({ subscription, charge, result, parties, now });
    const outcome = transition(toState(subscription), event, transitionContextFor(subscription, parties.tenant));
    if (outcome.kind === OUTCOME_KIND.REJECTED) return true;
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
