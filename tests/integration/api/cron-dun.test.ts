import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { DUN_PATH } from '@tests/utils/paths';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END } from '@tests/utils/renewal-rows';
import { TEST_CRON_SECRET, TEST_NOW, testApp } from '@tests/utils/test-app';

const POST = { method: 'POST' } as const;

describe('POST /internal/cron/dun (ADR 0002, ADR 0014)', () => {
  it("retries what is due at the app's clock: charges the next attempt, rescues, and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pastDue = await seedPastDue(tx, {
        currentPeriodEnd: TEST_NOW,
        dunningStartedAt: TEST_NOW,
        nextRetryAt: TEST_NOW,
      });
      const { subscriptionId } = pastDue.subscription;
      const provider = providers.providerOf(pastDue.ctx.providerConnectionId);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      const res = await testApp(tx, { providerFor: providers.providerFor }).request(DUN_PATH, {
        ...bearer(TEST_CRON_SECRET),
        ...POST,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0 });

      expect(provider.calls.charge).toEqual([
        expect.objectContaining({ dedupKey: `${subscriptionId}:${PERIOD_END.toISOString()}:1` }),
      ]);
      expect(await chargesAfterHistory(tx, pastDue)).toEqual([
        expect.objectContaining({ kind: CHARGE_KIND.RETRY, attempt: 1, status: CHARGE_STATUS.SUCCEEDED }),
      ]);
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
        nextRetryAt: null,
      });
    });
  });

  it('rejects a call without the cron secret and charges nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedPastDue(tx, {
        currentPeriodEnd: TEST_NOW,
        dunningStartedAt: TEST_NOW,
        nextRetryAt: TEST_NOW,
      });
      const res = await testApp(tx, { providerFor: providers.providerFor }).request(DUN_PATH, POST);
      expect(res.status).toBe(401);
      expect(providers.providerOf(ctx.providerConnectionId).calls.charge).toEqual([]);
    });
  });
});
