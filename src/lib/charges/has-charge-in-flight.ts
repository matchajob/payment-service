import { and, eq, isNull } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';

export const hasChargeInFlight = async (tx: Database, subscriptionId: Charge['subscriptionId']): Promise<boolean> => {
  const [inFlight] = await tx
    .select({ chargeId: chargesTable.chargeId })
    .from(chargesTable)
    .where(
      and(
        eq(chargesTable.subscriptionId, subscriptionId),
        eq(chargesTable.status, CHARGE_STATUS.PENDING),
        isNull(chargesTable.reconcileFlag),
      ),
    )
    .limit(1);
  return inFlight !== undefined;
};
