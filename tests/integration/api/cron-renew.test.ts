import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEW_PATH } from '@tests/utils/paths';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { TEST_CRON_SECRET, TEST_NOW, testApp } from '@tests/utils/test-app';

const POST = { method: 'POST' } as const;

describe('POST /internal/cron/renew (ADR 0002, ADR 0013)', () => {
  it("renews what is due at the app's clock: charges the next period, advances, emits, and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const renewing = await seedRenewing(tx, { currentPeriodEnd: TEST_NOW });
      const { subscriptionId } = renewing.subscription;
      const provider = providers.providerOf(renewing.ctx.providerConnectionId);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      const res = await testApp(tx, { providerFor: providers.providerFor }).request(RENEW_PATH, {
        ...bearer(TEST_CRON_SECRET),
        ...POST,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0 });

      expect(provider.calls.charge).toEqual([
        expect.objectContaining({ dedupKey: `${subscriptionId}:${PERIOD_END.toISOString()}:0` }),
      ]);
      expect(await chargesAfterHistory(tx, renewing)).toEqual([
        expect.objectContaining({ kind: CHARGE_KIND.RENEWAL, periodEnd: PERIOD_END, status: CHARGE_STATUS.SUCCEEDED }),
      ]);
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
      });
      const events = await eventsOf(tx, subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED]);
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
