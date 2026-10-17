import { eq } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';
import { SETTLE_FLAGGED, type SettleFlaggedOutcome } from '@/lib/reconcile/settle-flagged-outcome';
import { settleReconciledCharge } from '@/lib/reconcile/settle-reconciled-charge';

export type SettleFlaggedInput = { chargeId: Charge['chargeId']; result: ChargeResult };

export const settleFlaggedCharge = async (
  db: Database,
  { chargeId, result }: SettleFlaggedInput,
  now: Date,
): Promise<SettleFlaggedOutcome> => {
  const [charge] = await db.select().from(chargesTable).where(eq(chargesTable.chargeId, chargeId)).limit(1);
  if (charge === undefined) return SETTLE_FLAGGED.NOT_FOUND;
  if (charge.status !== CHARGE_STATUS.PENDING || charge.reconcileFlag === null) return SETTLE_FLAGGED.NOT_SETTLEABLE;
  return (await settleReconciledCharge(db, charge, result, now))
    ? SETTLE_FLAGGED.SETTLED
    : SETTLE_FLAGGED.NOT_SETTLEABLE;
};
