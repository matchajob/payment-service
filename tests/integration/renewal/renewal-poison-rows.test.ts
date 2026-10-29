import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { providerDownFor } from '@tests/utils/provider-down-for';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, subscriptionRow } from '@tests/utils/renewal-reads';
import { RENEWAL_BATCH_LIMIT } from '@/lib/renewal/renewal-batch-limit';
import { addRenewing, PERIOD_END, seedRenewing, seedRenewings } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const ONE_PER_RUN = 1;
const SECOND_CUSTOMER = 1;
const EARLIER_DUE = after(PERIOD_END, -HOUR_MS);
const FIRST_RUN = after(PERIOD_END, HOUR_MS);
const SECOND_RUN = after(FIRST_RUN, HOUR_MS);
const THIRD_RUN = after(SECOND_RUN, HOUR_MS);
const FAILED_ONE = { processed: 0, failed: 1 };
const RENEWED_ONE = { processed: 1, failed: 0 };
const RENEWED = expect.objectContaining({ kind: CHARGE_KIND.RENEWAL, status: CHARGE_STATUS.SUCCEEDED });

describe('runRenewal: a renewal that throws goes to the back of the queue (code-review-1 H4)', () => {
  it('does not block due renewals behind it', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedRenewing(tx, { currentPeriodEnd: EARLIER_DUE });
      const healthy = await seedRenewing(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const renew = renewWith(tx, providerDownFor(providers, broken.ctx.providerConnectionId), ONE_PER_RUN);

      expect(await renew(FIRST_RUN)).toEqual(FAILED_ONE);
      expect(await renew(SECOND_RUN)).toEqual(RENEWED_ONE);

      expect(await chargesAfterHistory(tx, healthy)).toEqual([RENEWED]);
    });
  });

  it('renews it on a later run once its provider works again', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedRenewing(tx, { currentPeriodEnd: EARLIER_DUE });
      const healthy = await seedRenewing(tx, {}, GLOBEX);
      providers.providerOf(broken.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const renewWhileDown = renewWith(tx, providerDownFor(providers, broken.ctx.providerConnectionId), ONE_PER_RUN);

      await renewWhileDown(FIRST_RUN);
      expect(await renewWhileDown(SECOND_RUN)).toEqual(RENEWED_ONE);
      expect(await renewWith(tx, providers.providerFor, ONE_PER_RUN)(THIRD_RUN)).toEqual(RENEWED_ONE);

      expect(await chargesAfterHistory(tx, broken)).toEqual([RENEWED]);
    });
  });

  it("does not let one tenant's broken connection stop another tenant's renewals at the real batch limit", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx: brokenTenant } = await seedRenewings(tx, RENEWAL_BATCH_LIMIT, { currentPeriodEnd: EARLIER_DUE });
      const healthy = await seedRenewing(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const renew = renewWith(tx, providerDownFor(providers, brokenTenant.providerConnectionId));

      expect(await renew(FIRST_RUN)).toEqual({ processed: 0, failed: RENEWAL_BATCH_LIMIT });
      await renew(SECOND_RUN);

      expect(await chargesAfterHistory(tx, healthy)).toEqual([RENEWED]);
    });
  });

  it('does not put it behind later renewals a period after it failed', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const once = await seedRenewing(tx);
      const provider = providers.providerOf(once.ctx.providerConnectionId);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      const renew = renewWith(tx, providers.providerFor, ONE_PER_RUN);
      await renewWith(tx, providerDownFor(providers, once.ctx.providerConnectionId), ONE_PER_RUN)(FIRST_RUN);
      await renew(SECOND_RUN);
      const { currentPeriodEnd } = await subscriptionRow(tx, once.subscription.subscriptionId);
      if (currentPeriodEnd === null) throw new Error('renewed subscription has no period end');
      const laterDue = after(currentPeriodEnd, HOUR_MS);
      const later = await addRenewing(tx, once.ctx, SECOND_CUSTOMER, { currentPeriodEnd: laterDue });

      expect(await renew(after(laterDue, HOUR_MS))).toEqual(RENEWED_ONE);

      expect(await chargesAfterHistory(tx, once)).toEqual([RENEWED, RENEWED]);
      expect(await chargesAfterHistory(tx, later)).toEqual([]);
    });
  });
});
