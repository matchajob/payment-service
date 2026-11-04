import type { Database } from '@/lib/db';
import { expireCheckout } from '@/lib/housekeeping/expire-checkout';
import type { ExpiredCheckout } from '@/lib/housekeeping/find-expired-checkouts';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { providerForConnectionId } from '@/lib/provider-connections/provider-for-connection-id';
import { CHECKOUT_COMPLETION } from '@/lib/subscriptions/checkout-completion';
import { completeCheckout } from '@/lib/subscriptions/complete-checkout';

export type SettleExpiredCheckoutDeps = { db: Database; providerFor: ProviderFor };

export const settleExpiredCheckout = async (
  { db, providerFor }: SettleExpiredCheckoutDeps,
  { subscriptionId, providerConnectionId, checkoutSessionRef }: ExpiredCheckout,
  now: Date,
): Promise<boolean> => {
  if (checkoutSessionRef === null) return expireCheckout(db, subscriptionId, now);
  const provider = await providerForConnectionId(db, providerFor, providerConnectionId);
  const completion = await completeCheckout(
    { db, provider, clock: { now: () => now } },
    { providerConnectionId, reference: subscriptionId, sessionRef: checkoutSessionRef },
  );
  if (completion === CHECKOUT_COMPLETION.HANDLED) return true;
  return expireCheckout(db, subscriptionId, now);
};
