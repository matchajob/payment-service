import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { RECONCILE_BATCH_LIMIT } from '@/lib/reconcile/reconcile-batch-limit';
import { seedLostRenewal, seedPendingRenewal, seedPendingRenewals } from '@tests/utils/pending-charge-rows';
import { providerDownFor } from '@tests/utils/provider-down-for';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { chargesAfterHistory } from '@tests/utils/renewal-reads';
import { silentLogger } from '@tests/utils/silent-logger';
import { GLOBEX } from '@tests/utils/tenant-fixtures';
import { VERIFIED_NOT_FOUND, VERIFIED_PENDING, VERIFIED_SUCCEEDED } from '@tests/utils/verified-charge-fixtures';

const ONE_PER_RUN = 1;
const EARLIER_ATTEMPT = after(RENEWAL_ATTEMPTED_AT, -HOUR_MS);
const FIRST_RUN = after(RENEWAL_ATTEMPTED_AT, HOUR_MS);
const SECOND_RUN = after(FIRST_RUN, HOUR_MS);
const NOTHING_DONE = { processed: 0, failed: 0, flagged: 0 };
const FAILED_ONE = { processed: 0, failed: 1, flagged: 0 };
const SETTLED_ONE = { processed: 1, failed: 0, flagged: 0 };
const FLAGGED_ONE = { processed: 0, failed: 0, flagged: 1 };

describe('runReconcile: a charge that makes no progress goes to the back of the queue (code-review-1 H4, N7)', () => {
  it('does not let a charge whose provider cannot be built block charges behind it', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedPendingRenewal(tx, { attemptedAt: EARLIER_ATTEMPT });
      const healthy = await seedPendingRenewal(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);
      const reconcile = reconcileWith(
        tx,
        providerDownFor(providers, broken.ctx.providerConnectionId),
        silentLogger,
        ONE_PER_RUN,
      );

      expect(await reconcile(FIRST_RUN)).toEqual(FAILED_ONE);
      expect(await reconcile(SECOND_RUN)).toEqual(SETTLED_ONE);

      expect(await chargesAfterHistory(tx, healthy)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED }),
      ]);
    });
  });

  it("does not let one tenant's broken connection stop another tenant's reconcile at the real batch limit", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const [broken] = await seedPendingRenewals(tx, RECONCILE_BATCH_LIMIT, { attemptedAt: EARLIER_ATTEMPT });
      if (broken === undefined) throw new Error('no broken charges seeded');
      const healthy = await seedPendingRenewal(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);
      const reconcile = reconcileWith(tx, providerDownFor(providers, broken.ctx.providerConnectionId));

      expect(await reconcile(FIRST_RUN)).toEqual({ processed: 0, failed: RECONCILE_BATCH_LIMIT, flagged: 0 });
      await reconcile(SECOND_RUN);

      expect(await chargesAfterHistory(tx, healthy)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED }),
      ]);
    });
  });

  it('puts a charge the provider still reports pending behind charges not yet checked', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const stillPending = await seedPendingRenewal(tx, { attemptedAt: EARLIER_ATTEMPT });
      const unchecked = await seedPendingRenewal(tx, {}, GLOBEX);
      providers.providerOf(stillPending.ctx.providerConnectionId).scriptVerify(VERIFIED_PENDING);
      providers.providerOf(unchecked.ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);
      const reconcile = reconcileWith(tx, providers.providerFor, silentLogger, ONE_PER_RUN);

      expect(await reconcile(FIRST_RUN)).toEqual(NOTHING_DONE);
      expect(await reconcile(SECOND_RUN)).toEqual(SETTLED_ONE);

      expect(providers.providerOf(unchecked.ctx.providerConnectionId).calls.verifyCharge).toHaveLength(ONE_PER_RUN);
    });
  });

  it('puts a lost charge the provider still cannot find behind lost charges not yet checked', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const stillLost = await seedLostRenewal(tx, { attemptedAt: EARLIER_ATTEMPT });
      const unchecked = await seedLostRenewal(tx, {}, GLOBEX);
      providers.providerOf(stillLost.ctx.providerConnectionId).scriptVerify(VERIFIED_NOT_FOUND);
      providers.providerOf(unchecked.ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);
      const reconcile = reconcileWith(tx, providers.providerFor, silentLogger, ONE_PER_RUN);

      expect(await reconcile(FIRST_RUN)).toEqual(NOTHING_DONE);
      expect(await reconcile(SECOND_RUN)).toEqual(FLAGGED_ONE);

      expect(await chargesAfterHistory(tx, unchecked)).toEqual([
        expect.objectContaining({ reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS }),
      ]);
    });
  });
});
