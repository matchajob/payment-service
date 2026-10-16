import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { recordChargeResult } from '@/lib/charges/record-charge-result';
import type { Charge } from '@/lib/charges/schema';
import type { Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import type { Tenant } from '@/lib/tenants/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';

export type SettleFirstChargeInput = {
  charge: Charge;
  result: ChargeResult;
  tenant: Tenant;
  customer: Customer;
  now: Date;
};

export const settleFirstCharge = (db: Database, { charge, result, tenant, customer, now }: SettleFirstChargeInput) =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, charge.subscriptionId);
    if (subscription === undefined) throw new Error('charged subscription missing');

    const succeeded = result.outcome === CHARGE_STATUS.SUCCEEDED;
    await recordChargeResult(tx, charge.chargeId, result);

    const event = succeeded ? LIFECYCLE_EVENT.FIRST_CHARGE_SUCCEEDED : LIFECYCLE_EVENT.FIRST_CHARGE_FAILED;
    const outcome = transition(toState(subscription), event, transitionContextFor(subscription, tenant));
    if (outcome.kind === OUTCOME_KIND.REJECTED) return;
    await applyTransition(tx, {
      subscription,
      outcome,
      changes: succeeded ? {} : { canceledAt: now, cancelReason: CANCEL_REASON.PAYMENT_FAILURE },
      customer,
      tenant,
      occurredAt: now,
    });
  });
