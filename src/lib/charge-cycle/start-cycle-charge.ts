import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { hasLiveCharge } from '@/lib/charges/has-live-charge';
import { chargesTable } from '@/lib/charges/schema';
import type { ChargeCycle } from '@/lib/charge-cycle/charge-cycle';
import { CYCLE_START, type CycleStart } from '@/lib/charge-cycle/cycle-start';
import { findCustomer } from '@/lib/customers/find-customer';
import type { Database } from '@/lib/db';
import { findCurrentPaymentMethod } from '@/lib/payments-method/find-current-payment-method';
import { findPlan } from '@/lib/plans/find-plan';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscriptionIfFree } from '@/lib/subscriptions/lock-subscription-if-free';
import type { Subscription } from '@/lib/subscriptions/schema';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import { findTenant } from '@/lib/tenants/find-tenant';
import { dunningScheduleOf } from '@/lib/tenants/dunning-schedule-of';

const MISSING_PARENTS = 'charged subscription references a missing tenant, customer or plan';
const NO_CANCEL = 'charge cycle reached a cancel on its due event but defines no cancel changes';
const NO_CARD = 'charged subscription has no current payment method';
const NO_ROW = 'charge insert returned no row';

export const startCycleCharge = (
  cycle: ChargeCycle,
  db: Database,
  subscriptionId: Subscription['subscriptionId'],
  now: Date,
): Promise<CycleStart> =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscriptionIfFree(tx, subscriptionId);
    if (subscription === undefined || !cycle.isDue(subscription, now)) return { kind: CYCLE_START.SKIPPED };
    const periodEnd = subscription.currentPeriodEnd;
    if (periodEnd === null || (await hasLiveCharge(tx, subscriptionId, periodEnd)))
      return { kind: CYCLE_START.SKIPPED };

    const tenant = await findTenant(tx, subscription.tenantId);
    const customer = await findCustomer(tx, subscription.tenantId, subscription.customerId);
    const plan = await findPlan(tx, subscription.tenantId, subscription.planId);
    if (tenant === undefined || customer === undefined || plan === undefined) throw new Error(MISSING_PARENTS);

    const outcome = transition(toState(subscription), cycle.dueEvent, transitionContextFor(subscription, tenant));
    if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: CYCLE_START.SKIPPED };
    if (outcome.to.status === SUBSCRIPTION_STATUS.CANCELED) {
      if (cycle.canceledOnDue === undefined) throw new Error(NO_CANCEL);
      await applyTransition(tx, {
        subscription,
        outcome,
        changes: cycle.canceledOnDue(now),
        customer,
        tenant,
        occurredAt: now,
      });
      return { kind: CYCLE_START.CANCELED };
    }

    const card = await findCurrentPaymentMethod(tx, subscriptionId);
    if (card === undefined) throw new Error(NO_CARD);
    const [charge] = await tx
      .insert(chargesTable)
      .values({
        tenantId: subscription.tenantId,
        subscriptionId,
        providerConnectionId: subscription.providerConnectionId,
        paymentMethodId: card.paymentMethodId,
        periodEnd,
        attempt: cycle.attemptOf(subscription),
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        status: CHARGE_STATUS.PENDING,
        providerChargeRef: null,
        failureReason: null,
        attemptedAt: now,
      })
      .returning();
    if (charge === undefined) throw new Error(NO_ROW);
    return {
      kind: CYCLE_START.CHARGE,
      charge,
      paymentMethodToken: card.providerToken,
      parties: { tenant, customer, plan, dunningScheduleDays: dunningScheduleOf(tenant) },
    };
  });
