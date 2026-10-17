import { describe, expect, it } from 'vitest';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RECONCILE_PATH } from '@tests/utils/paths';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { HOUR_MS } from '@tests/utils/reconcile-times';
import { TEST_CRON_SECRET, TEST_NOW, testApp } from '@tests/utils/test-app';
import { VERIFIED_SUCCEEDED } from '@tests/utils/verified-charge-fixtures';

const POST = { method: 'POST' } as const;
const AN_HOUR_AGO = new Date(TEST_NOW.getTime() - HOUR_MS);

describe('POST /internal/cron/reconcile (ADR 0002, ADR 0017)', () => {
  it("reconciles what is due at the app's clock and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedPendingRenewal(tx, { attemptedAt: AN_HOUR_AGO });
      providers.providerOf(ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);

      const res = await testApp(tx, { providerFor: providers.providerFor }).request(RECONCILE_PATH, {
        ...bearer(TEST_CRON_SECRET),
        ...POST,
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0, flagged: 0 });
    });
  });

  it('rejects a call without the cron secret and asks the provider nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedPendingRenewal(tx, { attemptedAt: AN_HOUR_AGO });

      const res = await testApp(tx, { providerFor: providers.providerFor }).request(RECONCILE_PATH, POST);

      expect(res.status).toBe(401);
      expect(providers.providerOf(ctx.providerConnectionId).calls.verifyCharge).toEqual([]);
    });
  });
});
