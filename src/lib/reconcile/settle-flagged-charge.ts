import { eq } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';
import { SETTLE_FLAGGED, type SettleFlaggedOutcome } from '@/lib/reconcile/settle-flagged-outcome';
import { settleReconciledCharge } from '@/lib/reconcile/settle-reconciled-charge';
import { findSubscription } from '@/lib/subscriptions/find-subscription';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

export type SettleFlaggedInput = { chargeId: Charge['chargeId']; result: ChargeResult };

export const settleFlaggedCharge = async (
  db: Database,
  { chargeId, result }: SettleFlaggedInput,
  now: Date,
): Promise<SettleFlaggedOutcome> => {
  const [charge] = await db.select().from(chargesTable).where(eq(chargesTable.chargeId, chargeId)).limit(1);
  if (charge === undefined) return SETTLE_FLAGGED.NOT_FOUND;
  if (charge.status !== CHARGE_STATUS.PENDING || charge.reconcileFlag === null) return SETTLE_FLAGGED.NOT_SETTLEABLE;
  if (!(await settleReconciledCharge(db, charge, result, now))) return SETTLE_FLAGGED.NOT_SETTLEABLE;
  if (result.outcome !== CHARGE_STATUS.SUCCEEDED) return SETTLE_FLAGGED.SETTLED;
  const subscription = await findSubscription(db, charge.tenantId, charge.subscriptionId);
  return subscription?.status === SUBSCRIPTION_STATUS.CANCELED
    ? SETTLE_FLAGGED.SETTLED_NEEDS_REFUND
    : SETTLE_FLAGGED.SETTLED;
};
