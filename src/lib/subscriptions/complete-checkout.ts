import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Clock } from '@/lib/clock';
import { findCustomer } from '@/lib/customers/find-customer';
import type { Database } from '@/lib/db';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { PaymentProvider } from '@/lib/payments/provider';
import { findPlan } from '@/lib/plans/find-plan';
import { activateCheckout } from '@/lib/subscriptions/activate-checkout';
import { ACTIVATION } from '@/lib/subscriptions/activation';
import { cancelAlreadySubscribed } from '@/lib/subscriptions/cancel-already-subscribed';
import { findSubscription } from '@/lib/subscriptions/find-subscription';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';
import { settleFirstCharge } from '@/lib/subscriptions/settle-first-charge';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import type { Tenant } from '@/lib/tenants/schema';

export type CompleteCheckoutDeps = { db: Database; provider: PaymentProvider; clock: Clock };
export type CompleteCheckoutInput = { tenant: Tenant; reference: string; sessionRef: string };

export const completeCheckout = async (
  { db, provider, clock }: CompleteCheckoutDeps,
  { tenant, reference, sessionRef }: CompleteCheckoutInput,
): Promise<void> => {
  const subscriptionId = zSubscriptionRead.shape.subscriptionId.safeParse(reference);
  if (!subscriptionId.success) return;
  const subscription = await findSubscription(db, tenant.tenantId, subscriptionId.data);
  if (subscription?.status !== SUBSCRIPTION_STATUS.INCOMPLETE) return;
  if (subscription.checkoutSessionRef !== sessionRef) return;

  const verified = await provider.verifyCheckout(sessionRef);
  if (verified.outcome === CHECKOUT_VERIFICATION.NOT_COMPLETED) return;

  const customer = await findCustomer(db, tenant.tenantId, subscription.customerId);
  const plan = await findPlan(db, tenant.tenantId, subscription.planId);
  if (customer === undefined || plan === undefined)
    throw new Error('subscription references a missing customer or plan');

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
    return;
  }
  if (activation.kind === ACTIVATION.RACED) return;

  const { charge } = activation;
  const result = await provider.charge({
    paymentMethodToken: verified.paymentMethodToken,
    amountMinor: charge.amountMinor,
    currency: charge.currency,
    dedupKey: chargeDedupKey(charge.subscriptionId, charge.periodEnd, charge.attempt),
  });
  await settleFirstCharge(db, { charge, result, tenant, customer, now: clock.now() });
};
