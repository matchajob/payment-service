import { and, eq, inArray } from 'drizzle-orm';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import { LIVE_CHARGE_STATUSES } from '@/lib/charges/live-charge-statuses';
import type { Database } from '@/lib/db';

export const hasLiveCharge = async (
  db: Database,
  subscriptionId: Charge['subscriptionId'],
  periodEnd: Charge['periodEnd'],
): Promise<boolean> => {
  const [live] = await db
    .select({ chargeId: chargesTable.chargeId })
    .from(chargesTable)
    .where(
      and(
        eq(chargesTable.subscriptionId, subscriptionId),
        eq(chargesTable.periodEnd, periodEnd),
        inArray(chargesTable.status, LIVE_CHARGE_STATUSES),
      ),
    )
    .limit(1);
  return live !== undefined;
};
