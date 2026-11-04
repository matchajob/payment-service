import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { SETTLE_FLAGGED, type SettleFlaggedOutcome } from '@/lib/reconcile/settle-flagged-outcome';

export type ResolveFlagInput = { chargeId: Charge['chargeId']; resolution: NonNullable<Charge['flagResolution']> };

export const resolveFlaggedCharge = async (
  db: Database,
  { chargeId, resolution }: ResolveFlagInput,
  now: Date,
): Promise<SettleFlaggedOutcome> => {
  const resolved = await db
    .update(chargesTable)
    .set({ flagResolvedAt: now, flagResolution: resolution })
    .where(
      and(
        eq(chargesTable.chargeId, chargeId),
        isNotNull(chargesTable.reconcileFlag),
        isNull(chargesTable.flagResolvedAt),
        ne(chargesTable.status, CHARGE_STATUS.PENDING),
      ),
    )
    .returning({ chargeId: chargesTable.chargeId });
  if (resolved.length > 0) return SETTLE_FLAGGED.RESOLVED;
  const [exists] = await db
    .select({ chargeId: chargesTable.chargeId })
    .from(chargesTable)
    .where(eq(chargesTable.chargeId, chargeId))
    .limit(1);
  return exists === undefined ? SETTLE_FLAGGED.NOT_FOUND : SETTLE_FLAGGED.NOT_SETTLEABLE;
};
