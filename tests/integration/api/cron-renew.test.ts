import { describe, expect, it } from 'vitest';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEW_PATH } from '@tests/utils/paths';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { TEST_CRON_SECRET, TEST_NOW, testApp } from '@tests/utils/test-app';

const POST = { method: 'POST' } as const;

describe('POST /internal/cron/renew (ADR 0002, ADR 0013)', () => {
  it("renews what is due at the app's clock and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedRenewing(tx, { currentPeriodEnd: TEST_NOW });
      providers.providerOf(ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const res = await testApp(tx, { providerFor: providers.providerFor }).request(RENEW_PATH, {
        ...bearer(TEST_CRON_SECRET),
        ...POST,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0 });
    });
  });

  it('rejects a call without the cron secret and charges nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedRenewing(tx, { currentPeriodEnd: TEST_NOW });
      const res = await testApp(tx, { providerFor: providers.providerFor }).request(RENEW_PATH, POST);
      expect(res.status).toBe(401);
      expect(providers.providerOf(ctx.providerConnectionId).calls.charge).toEqual([]);
    });
  });
});
