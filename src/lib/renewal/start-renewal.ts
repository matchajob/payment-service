import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { hasLiveCharge } from '@/lib/charges/has-live-charge';
import { chargesTable } from '@/lib/charges/schema';
import { findCustomer } from '@/lib/customers/find-customer';
import type { Database } from '@/lib/db';
import { findCurrentPaymentMethod } from '@/lib/payments-method/find-current-payment-method';
import { findPlan } from '@/lib/plans/find-plan';
import { RENEWAL_START, type RenewalStart } from '@/lib/renewal/renewal-start';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscriptionIfFree } from '@/lib/subscriptions/lock-subscription-if-free';
import type { Subscription } from '@/lib/subscriptions/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import { findTenant } from '@/lib/tenants/find-tenant';

const RENEWAL_ATTEMPT = 0;
const MISSING_PARENTS = 'renewing subscription references a missing tenant, customer or plan';
const NO_CARD = 'renewing subscription has no current payment method';
const NO_ROW = 'renewal charge insert returned no row';

export const startRenewal = (
  db: Database,
  subscriptionId: Subscription['subscriptionId'],
  now: Date,
): Promise<RenewalStart> =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscriptionIfFree(tx, subscriptionId);
    const periodEnd = subscription?.currentPeriodEnd;
    if (subscription?.status !== SUBSCRIPTION_STATUS.ACTIVE || periodEnd == null || periodEnd > now)
      return { kind: RENEWAL_START.SKIPPED };
    if (await hasLiveCharge(tx, subscriptionId, periodEnd)) return { kind: RENEWAL_START.SKIPPED };

    const tenant = await findTenant(tx, subscription.tenantId);
    const customer = await findCustomer(tx, subscription.tenantId, subscription.customerId);
    const plan = await findPlan(tx, subscription.tenantId, subscription.planId);
    if (tenant === undefined || customer === undefined || plan === undefined) throw new Error(MISSING_PARENTS);

    const outcome = transition(
      toState(subscription),
      LIFECYCLE_EVENT.RENEWAL_DUE,
      transitionContextFor(subscription, tenant),
    );
    if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: RENEWAL_START.SKIPPED };
    if (outcome.to.status === SUBSCRIPTION_STATUS.CANCELED) {
      await applyTransition(tx, {
        subscription,
        outcome,
        changes: { canceledAt: now },
        customer,
        tenant,
        occurredAt: now,
      });
      return { kind: RENEWAL_START.CANCELED };
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
        attempt: RENEWAL_ATTEMPT,
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
      kind: RENEWAL_START.CHARGE,
      charge,
      paymentMethodToken: card.providerToken,
      parties: { tenant, customer, plan },
    };
  });
