import type { Logger } from 'pino';
import type { Clock } from '@/lib/clock';
import { findCustomer } from '@/lib/customers/find-customer';
import type { Database } from '@/lib/db';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { PaymentProvider } from '@/lib/payments/provider';
import { findPlan } from '@/lib/plans/find-plan';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { activateCheckout } from '@/lib/subscriptions/activate-checkout';
import { ACTIVATION } from '@/lib/subscriptions/activation';
import { cancelAlreadySubscribed } from '@/lib/subscriptions/cancel-already-subscribed';
import { CHECKOUT_COMPLETION, type CheckoutCompletion } from '@/lib/subscriptions/checkout-completion';
import { findSubscriptionOnConnection } from '@/lib/subscriptions/find-subscription-on-connection';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';
import { settleFirstCharge } from '@/lib/subscriptions/settle-first-charge';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { findTenant } from '@/lib/tenants/find-tenant';
import { chargeRequestFor } from '@/lib/charges/charge-request-for';
import { ignoredCompletion } from '@/lib/webhooks/ignored-completion';
import { IGNORED_REASON } from '@/lib/webhooks/ignored-reason';

const MISSING_PARENTS = 'subscription references a missing tenant, customer or plan';

export type CompleteCheckoutDeps = {
  db: Database;
  provider: PaymentProvider;
  clock: Clock;
  logger: Pick<Logger, 'warn'>;
};
export type CompleteCheckoutInput = {
  providerConnectionId: ProviderConnection['providerConnectionId'];
  reference: string;
  sessionRef: string;
};

export const completeCheckout = async (
  { db, provider, clock, logger }: CompleteCheckoutDeps,
  { providerConnectionId, reference, sessionRef }: CompleteCheckoutInput,
): Promise<CheckoutCompletion> => {
  const subscriptionId = zSubscriptionRead.shape.subscriptionId.safeParse(reference);
  const unknown = () =>
    ignoredCompletion(logger, IGNORED_REASON.UNKNOWN_SUBSCRIPTION, { providerConnectionId, reference });
  if (!subscriptionId.success) return unknown();
  const subscription = await findSubscriptionOnConnection(db, providerConnectionId, subscriptionId.data);
  if (subscription === undefined) return unknown();
  const ids = { providerConnectionId, subscriptionId: subscription.subscriptionId };
  if (subscription.status !== SUBSCRIPTION_STATUS.INCOMPLETE) {
    return ignoredCompletion(logger, IGNORED_REASON.NOT_AWAITING_CHECKOUT, { ...ids, status: subscription.status });
  }
  if (subscription.checkoutSessionRef !== sessionRef) {
    return ignoredCompletion(logger, IGNORED_REASON.SESSION_MISMATCH, { ...ids, sessionRef });
  }

  const verified = await provider.verifyCheckout(sessionRef);
  if (verified.outcome === CHECKOUT_VERIFICATION.NOT_COMPLETED) return CHECKOUT_COMPLETION.NOT_COMPLETED;

  const tenant = await findTenant(db, subscription.tenantId);
  const customer = await findCustomer(db, subscription.tenantId, subscription.customerId);
  const plan = await findPlan(db, subscription.tenantId, subscription.planId);
  if (tenant === undefined || customer === undefined || plan === undefined) throw new Error(MISSING_PARENTS);

  const activation = await activateCheckout(db, {
    subscriptionId: subscription.subscriptionId,
    sessionRef,
    paymentMethodToken: verified.paymentMethodToken,
    tenant,
    customer,
    plan,
    now: clock.now(),
  });
  if (activation.kind === ACTIVATION.ALREADY_SUBSCRIBED) {
    await cancelAlreadySubscribed(db, {
      subscriptionId: subscription.subscriptionId,
      tenant,
      customer,
      now: clock.now(),
    });
    return CHECKOUT_COMPLETION.HANDLED;
  }
  if (activation.kind === ACTIVATION.RACED) return CHECKOUT_COMPLETION.HANDLED;

  const { charge } = activation;
  const result = await provider.charge(chargeRequestFor(charge, verified.paymentMethodToken));
  await settleFirstCharge(db, { charge, result, tenant, customer, now: clock.now() });
  return CHECKOUT_COMPLETION.HANDLED;
};
