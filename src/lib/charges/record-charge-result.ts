import { and, eq } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { declineReason } from '@/lib/charges/decline-reason';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';

export const recordChargeResult = async (
  tx: Database,
  chargeId: Charge['chargeId'],
  result: ChargeResult,
): Promise<boolean> => {
  const settled = await tx
    .update(chargesTable)
    .set(
      result.outcome === CHARGE_STATUS.SUCCEEDED
        ? { status: CHARGE_STATUS.SUCCEEDED, providerChargeRef: result.providerChargeRef }
        : {
            status: CHARGE_STATUS.FAILED,
            providerChargeRef: result.providerChargeRef ?? null,
            failureReason: declineReason(result.reason),
          },
    )
    .where(and(eq(chargesTable.chargeId, chargeId), eq(chargesTable.status, CHARGE_STATUS.PENDING)))
    .returning({ chargeId: chargesTable.chargeId });
  return settled.length > 0;
};
