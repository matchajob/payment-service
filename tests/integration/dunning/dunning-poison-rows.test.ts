import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, FIRST_RETRY_DAY } from '@tests/utils/dunning-days';
import { DUNNING_BATCH_LIMIT } from '@/lib/dunning/dunning-batch-limit';
import { seedPastDue, seedPastDues } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { providerDownFor } from '@tests/utils/provider-down-for';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory } from '@tests/utils/renewal-reads';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const ONE_PER_RUN = 1;
const RETRY_AT = dunningDay(FIRST_RETRY_DAY);
const EARLIER_RETRY = after(RETRY_AT, -HOUR_MS);
const FIRST_RUN = after(RETRY_AT, HOUR_MS);
const SECOND_RUN = after(FIRST_RUN, HOUR_MS);
const THIRD_RUN = after(SECOND_RUN, HOUR_MS);
const FAILED_ONE = { processed: 0, failed: 1 };
const RETRIED_ONE = { processed: 1, failed: 0 };
const RETRIED = expect.objectContaining({ kind: CHARGE_KIND.RETRY, status: CHARGE_STATUS.SUCCEEDED });

describe('runDunning: a retry that throws goes to the back of the queue (code-review-1 H4)', () => {
  it('does not block due retries behind it', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedPastDue(tx, { nextRetryAt: EARLIER_RETRY });
      const healthy = await seedPastDue(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const dun = dunWith(tx, providerDownFor(providers, broken.ctx.providerConnectionId), ONE_PER_RUN);

      expect(await dun(FIRST_RUN)).toEqual(FAILED_ONE);
      expect(await dun(SECOND_RUN)).toEqual(RETRIED_ONE);

      expect(await chargesAfterHistory(tx, healthy)).toEqual([RETRIED]);
    });
  });

  it("does not let one tenant's broken connection stop another tenant's retries at the real batch limit", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx: brokenTenant } = await seedPastDues(tx, DUNNING_BATCH_LIMIT, { nextRetryAt: EARLIER_RETRY });
      const healthy = await seedPastDue(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const dun = dunWith(tx, providerDownFor(providers, brokenTenant.providerConnectionId));

      expect(await dun(FIRST_RUN)).toEqual({ processed: 0, failed: DUNNING_BATCH_LIMIT });
      await dun(SECOND_RUN);

      expect(await chargesAfterHistory(tx, healthy)).toEqual([RETRIED]);
    });
  });

  it('retries it on a later run once its provider works again', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedPastDue(tx, { nextRetryAt: EARLIER_RETRY });
      const healthy = await seedPastDue(tx, {}, GLOBEX);
      providers.providerOf(broken.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const dunWhileDown = dunWith(tx, providerDownFor(providers, broken.ctx.providerConnectionId), ONE_PER_RUN);

      await dunWhileDown(FIRST_RUN);
      expect(await dunWhileDown(SECOND_RUN)).toEqual(RETRIED_ONE);
      expect(await dunWith(tx, providers.providerFor, ONE_PER_RUN)(THIRD_RUN)).toEqual(RETRIED_ONE);

      expect(await chargesAfterHistory(tx, broken)).toEqual([RETRIED]);
    });
  });
});
