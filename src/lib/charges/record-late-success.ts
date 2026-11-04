import { and, eq } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';

export const recordLateSuccess = async (
  tx: Database,
  chargeId: Charge['chargeId'],
  providerChargeRef: string,
): Promise<boolean> => {
  const settled = await tx
    .update(chargesTable)
    .set({ status: CHARGE_STATUS.SUCCEEDED, providerChargeRef, failureReason: null })
    .where(
      and(
        eq(chargesTable.chargeId, chargeId),
        eq(chargesTable.status, CHARGE_STATUS.FAILED),
        eq(chargesTable.failureReason, NOT_FOUND_REASON),
      ),
    )
    .returning({ chargeId: chargesTable.chargeId });
  return settled.length > 0;
};
