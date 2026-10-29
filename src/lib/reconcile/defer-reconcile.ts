import { eq } from 'drizzle-orm';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';

export const deferReconcile = async (db: Database, chargeId: Charge['chargeId'], now: Date): Promise<void> => {
  await db.update(chargesTable).set({ reconcileDeferredAt: now }).where(eq(chargesTable.chargeId, chargeId));
};
