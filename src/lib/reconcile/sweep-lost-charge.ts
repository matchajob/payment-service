import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import type { Charge } from '@/lib/charges/schema';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { providerForConnectionId } from '@/lib/provider-connections/provider-for-connection-id';
import { flagCharge } from '@/lib/reconcile/flag-charge';
import type { ReconcileDeps } from '@/lib/reconcile/reconcile-deps';
import { RECONCILE_RESULT, type ReconcileResult } from '@/lib/reconcile/reconcile-result';
import { verifyRequestFor } from '@/lib/reconcile/verify-request-for';
import { findPaymentMethodToken } from '@/lib/payments-method/find-payment-method-token';

export const sweepLostCharge = async (
  { db, providerFor, logger }: ReconcileDeps,
  charge: Charge,
  now: Date,
): Promise<ReconcileResult> => {
  const provider = await providerForConnectionId(db, providerFor, charge.providerConnectionId);
  const verified = await provider.verifyCharge(
    verifyRequestFor(charge, await findPaymentMethodToken(db, charge.paymentMethodId)),
  );
  if (verified.outcome !== VERIFY_OUTCOME.SUCCEEDED) return RECONCILE_RESULT.LEFT;
  return (await flagCharge(db, logger, charge, RECONCILE_FLAG.LATE_SUCCESS, now))
    ? RECONCILE_RESULT.FLAGGED
    : RECONCILE_RESULT.LEFT;
};
