import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { RECONCILE_FLAG, type ReconcileFlag } from '@/lib/charges/reconcile-flag';
import type { Charge } from '@/lib/charges/schema';
import type { ChargeResult } from '@/lib/payments/provider';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { providerForConnectionId } from '@/lib/provider-connections/provider-for-connection-id';
import { flagCharge } from '@/lib/reconcile/flag-charge';
import type { ReconcileDeps } from '@/lib/reconcile/reconcile-deps';
import { RECONCILE_RESULT, type ReconcileResult } from '@/lib/reconcile/reconcile-result';
import { RECONCILE_WINDOW } from '@/lib/reconcile/reconcile-windows';
import { settleReconciledCharge } from '@/lib/reconcile/settle-reconciled-charge';
import { verifyRequestFor } from '@/lib/reconcile/verify-request-for';

const LOST: ChargeResult = { outcome: VERIFY_OUTCOME.FAILED, providerChargeRef: undefined, reason: NOT_FOUND_REASON };

const matches = (charge: Charge, verified: Pick<Charge, 'amountMinor' | 'currency'>): boolean =>
  verified.amountMinor === charge.amountMinor && verified.currency === charge.currency;

export const reconcileCharge = async (
  { db, providerFor, logger }: ReconcileDeps,
  charge: Charge,
  now: Date,
): Promise<ReconcileResult> => {
  const flag = async (reconcileFlag: ReconcileFlag) =>
    (await flagCharge(db, logger, charge, reconcileFlag, now)) ? RECONCILE_RESULT.FLAGGED : RECONCILE_RESULT.LEFT;
  const settle = async (result: ChargeResult) =>
    (await settleReconciledCharge(db, charge, result, now)) ? RECONCILE_RESULT.SETTLED : RECONCILE_RESULT.LEFT;

  const provider = await providerForConnectionId(db, providerFor, charge.providerConnectionId);
  if (charge.providerChargeRef === null && !provider.capabilities.lookupByReference)
    return flag(RECONCILE_FLAG.NO_REFERENCE_LOOKUP);

  const verified = await provider.verifyCharge(verifyRequestFor(charge));
  const age = now.getTime() - charge.attemptedAt.getTime();
  switch (verified.outcome) {
    case VERIFY_OUTCOME.SUCCEEDED:
      return matches(charge, verified) ? settle(verified) : flag(RECONCILE_FLAG.AMOUNT_MISMATCH);
    case VERIFY_OUTCOME.FAILED:
      return settle(verified);
    case VERIFY_OUTCOME.PENDING:
      return age < RECONCILE_WINDOW.GIVE_UP_MS ? RECONCILE_RESULT.LEFT : flag(RECONCILE_FLAG.STUCK_PENDING);
    case VERIFY_OUTCOME.NOT_FOUND:
      if (charge.providerChargeRef !== null) return flag(RECONCILE_FLAG.REF_NOT_FOUND);
      return age < RECONCILE_WINDOW.NOT_FOUND_GRACE_MS ? RECONCILE_RESULT.LEFT : settle(LOST);
  }
};
