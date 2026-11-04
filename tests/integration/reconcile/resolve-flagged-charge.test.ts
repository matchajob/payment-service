import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import { zChargeRead } from '@/lib/charges/schema';
import { resolveFlaggedCharge } from '@/lib/reconcile/resolve-flagged-charge';
import { SETTLE_FLAGGED } from '@/lib/reconcile/settle-flagged-outcome';
import { testDb, withRollback } from '@tests/utils/db';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedLostRenewal, seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { after, GIVE_UP_MS } from '@tests/utils/reconcile-times';
import { chargesAfterHistory } from '@tests/utils/renewal-reads';

const FLAGGED_AT = after(RENEWAL_ATTEMPTED_AT, GIVE_UP_MS);
const RESOLVED_AT = after(FLAGGED_AT, GIVE_UP_MS);
const LATE_SUCCESS = { reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS, flaggedAt: FLAGGED_AT } as const;
const STUCK = { reconcileFlag: RECONCILE_FLAG.STUCK_PENDING, flaggedAt: FLAGGED_AT } as const;
const RESOLUTION = 'refunded at the provider on 2026-11-04';
const OTHER_RESOLUTION = 'second look';

describe('resolveFlaggedCharge: a human closes a flag after acting outside the system (code-review-1 M9)', () => {
  it('records when and why a late success was resolved, and leaves the charge itself as it was', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx, LATE_SUCCESS);

      expect(
        await resolveFlaggedCharge(tx, { chargeId: lost.charge.chargeId, resolution: RESOLUTION }, RESOLVED_AT),
      ).toBe(SETTLE_FLAGGED.RESOLVED);

      expect(await chargesAfterHistory(tx, lost)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.FAILED,
          failureReason: NOT_FOUND_REASON,
          reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS,
          flaggedAt: FLAGGED_AT,
          flagResolvedAt: RESOLVED_AT,
          flagResolution: RESOLUTION,
        }),
      ]);
    });
  });

  it('refuses a flagged charge that is still pending: settle it instead, so the subscription follows', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx, STUCK);

      expect(
        await resolveFlaggedCharge(tx, { chargeId: pending.charge.chargeId, resolution: RESOLUTION }, RESOLVED_AT),
      ).toBe(SETTLE_FLAGGED.NOT_SETTLEABLE);

      expect(await chargesAfterHistory(tx, pending)).toEqual([expect.objectContaining({ flagResolvedAt: null })]);
    });
  });

  it('refuses a charge nobody flagged', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      expect(
        await resolveFlaggedCharge(tx, { chargeId: lost.charge.chargeId, resolution: RESOLUTION }, RESOLVED_AT),
      ).toBe(SETTLE_FLAGGED.NOT_SETTLEABLE);
    });
  });

  it('refuses to resolve twice, so the first record stands', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx, LATE_SUCCESS);
      await resolveFlaggedCharge(tx, { chargeId: lost.charge.chargeId, resolution: RESOLUTION }, RESOLVED_AT);

      expect(
        await resolveFlaggedCharge(tx, { chargeId: lost.charge.chargeId, resolution: OTHER_RESOLUTION }, RESOLVED_AT),
      ).toBe(SETTLE_FLAGGED.NOT_SETTLEABLE);

      expect(await chargesAfterHistory(tx, lost)).toEqual([expect.objectContaining({ flagResolution: RESOLUTION })]);
    });
  });

  it('answers not found for an unknown charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const unknown = zChargeRead.shape.chargeId.parse(randomUUID());
      expect(await resolveFlaggedCharge(tx, { chargeId: unknown, resolution: RESOLUTION }, RESOLVED_AT)).toBe(
        SETTLE_FLAGGED.NOT_FOUND,
      );
    });
  });
});
