import { and, eq } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';

export const hasSucceededCharge = async (db: Database, subscriptionId: Charge['subscriptionId']): Promise<boolean> => {
  const [succeeded] = await db
    .select({ chargeId: chargesTable.chargeId })
    .from(chargesTable)
    .where(and(eq(chargesTable.subscriptionId, subscriptionId), eq(chargesTable.status, CHARGE_STATUS.SUCCEEDED)))
    .limit(1);
  return succeeded !== undefined;
};
