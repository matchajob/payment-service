import type { Database } from '@/lib/db';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { paymentMethodUpdatesTable } from '@/lib/payment-method-updates/schema';
import { START_CARD_UPDATE } from '@/lib/payment-method-updates/start-card-update-outcome';
import { findPlan } from '@/lib/plans/find-plan';
import { providerForConnectionId } from '@/lib/provider-connections/provider-for-connection-id';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { findSubscription } from '@/lib/subscriptions/find-subscription';
import type { Subscription } from '@/lib/subscriptions/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import type { RejectionReason } from '@/lib/subscriptions/state-machine/rejection-reason';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import type { Tenant } from '@/lib/tenants/schema';

const MISSING_PLAN = 'subscription references a missing plan';

export type StartPaymentMethodUpdateDeps = { db: Database; providerFor: ProviderFor };
export type StartPaymentMethodUpdateInput = {
  tenant: Tenant;
  subscriptionId: Subscription['subscriptionId'];
  returnUrl: string;
  now: Date;
};
export type StartPaymentMethodUpdateResult =
  | { kind: typeof START_CARD_UPDATE.STARTED; checkoutUrl: string }
  | { kind: typeof START_CARD_UPDATE.NOT_FOUND }
  | { kind: typeof START_CARD_UPDATE.REJECTED; reason: RejectionReason };

export const startPaymentMethodUpdate = async (
  { db, providerFor }: StartPaymentMethodUpdateDeps,
  { tenant, subscriptionId, returnUrl, now }: StartPaymentMethodUpdateInput,
): Promise<StartPaymentMethodUpdateResult> => {
  const subscription = await findSubscription(db, tenant.tenantId, subscriptionId);
  if (subscription === undefined) return { kind: START_CARD_UPDATE.NOT_FOUND };
  const outcome = transition(
    toState(subscription),
    LIFECYCLE_EVENT.PAYMENT_METHOD_UPDATED,
    transitionContextFor(subscription, tenant),
  );
  if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: START_CARD_UPDATE.REJECTED, reason: outcome.reason };
  const plan = await findPlan(db, tenant.tenantId, subscription.planId);
  if (plan === undefined) throw new Error(MISSING_PLAN);

  const provider = await providerForConnectionId(db, providerFor, subscription.providerConnectionId);
  const session = await provider.startCheckout({
    mode: CHECKOUT_MODE.CAPTURE,
    reference: subscriptionId,
    amountMinor: plan.amountMinor,
    currency: plan.currency,
    returnUrl,
  });
  await db.insert(paymentMethodUpdatesTable).values({
    tenantId: tenant.tenantId,
    subscriptionId,
    providerConnectionId: subscription.providerConnectionId,
    sessionRef: session.providerSessionRef,
    requestedAt: now,
    completedAt: null,
  });
  return { kind: START_CARD_UPDATE.STARTED, checkoutUrl: session.checkoutUrl };
};
