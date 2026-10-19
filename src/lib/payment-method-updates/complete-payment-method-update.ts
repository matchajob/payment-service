import { settleCycleCharge } from '@/lib/charge-cycle/settle-cycle-charge';
import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Clock } from '@/lib/clock';
import type { Database } from '@/lib/db';
import { immediateRetryDecide } from '@/lib/payment-method-updates/immediate-retry-decide';
import { replacePaymentMethod } from '@/lib/payment-method-updates/replace-payment-method';
import { REPLACEMENT } from '@/lib/payment-method-updates/replacement';
import type { PaymentMethodUpdate } from '@/lib/payment-method-updates/schema';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { PaymentProvider } from '@/lib/payments/provider';
import { chargeRequestFor } from '@/lib/charges/charge-request-for';

export type CompletePaymentMethodUpdateDeps = { db: Database; provider: PaymentProvider; clock: Clock };

export const completePaymentMethodUpdate = async (
  { db, provider, clock }: CompletePaymentMethodUpdateDeps,
  update: PaymentMethodUpdate,
  reference: string,
): Promise<void> => {
  if (update.completedAt !== null || update.subscriptionId !== reference) return;
  const verified = await provider.verifyCheckout(update.sessionRef);
  if (verified.outcome === CHECKOUT_VERIFICATION.NOT_COMPLETED) return;

  const replaced = await replacePaymentMethod(db, {
    update,
    paymentMethodToken: verified.paymentMethodToken,
    now: clock.now(),
  });
  if (replaced.kind !== REPLACEMENT.RETRY) return;

  const { charge, parties } = replaced;
  const result = await provider.charge(chargeRequestFor(charge, verified.paymentMethodToken));
  await settleCycleCharge(immediateRetryDecide, db, { charge, result, parties, now: clock.now() });
};
