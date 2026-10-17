import { and, eq, isNull } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { ReconcileFlag } from '@/lib/charges/reconcile-flag';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';

export const flagCharge = async (
  db: Database,
  logger: Pick<Logger, 'error'>,
  charge: Charge,
  reconcileFlag: ReconcileFlag,
  now: Date,
): Promise<boolean> => {
  const flagged = await db
    .update(chargesTable)
    .set({ reconcileFlag, flaggedAt: now })
    .where(
      and(
        eq(chargesTable.chargeId, charge.chargeId),
        eq(chargesTable.status, charge.status),
        isNull(chargesTable.reconcileFlag),
      ),
    )
    .returning({ chargeId: chargesTable.chargeId });
  if (flagged.length === 0) return false;
  logger.error(
    { chargeId: charge.chargeId, subscriptionId: charge.subscriptionId, reconcileFlag },
    'charge needs a human: reconcile cannot settle it',
  );
  return true;
};
