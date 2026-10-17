import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { recordChargeResult } from '@/lib/charges/record-charge-result';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { RENEWAL_CHARGE_REF, RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf } from '@tests/utils/renewal-reads';

describe('recordChargeResult: settles only a pending charge (ADR 0017 decision 3)', () => {
  it('settles a pending charge and says so', async () => {
    await withRollback(testDb(), async (tx) => {
      const { charge } = await seedPendingRenewal(tx);
      expect(await recordChargeResult(tx, charge.chargeId, RENEWAL_SUCCEEDED)).toBe(true);
    });
  });

  it('refuses a second settle, so a live settle and reconcile cannot both apply their transition', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedPendingRenewal(tx);
      await recordChargeResult(tx, charge.chargeId, RENEWAL_SUCCEEDED);

      expect(await recordChargeResult(tx, charge.chargeId, DECLINED)).toBe(false);

      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED, providerChargeRef: RENEWAL_CHARGE_REF }),
      ]);
    });
  });
});
