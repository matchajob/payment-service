import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { HOUSEKEEPING_PATH } from '@tests/utils/paths';
import { HOUR_MS } from '@tests/utils/reconcile-times';
import { subscriptionRow } from '@tests/utils/renewal-reads';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import { TEST_CRON_SECRET, TEST_NOW, testApp } from '@tests/utils/test-app';

const POST = { method: 'POST' } as const;
const DEFAULT_TTL_HOURS = 12;
const ABANDONED_AT = new Date(TEST_NOW.getTime() - DEFAULT_TTL_HOURS * HOUR_MS);

describe('POST /internal/cron/housekeeping (ADR 0002, S1 r3)', () => {
  it("expires what is due at the app's clock and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const parents = await seedSubscriptionParents(tx);
      await insertSubscription(tx, parents, { createdAt: ABANDONED_AT });

      const res = await testApp(tx).request(HOUSEKEEPING_PATH, { ...bearer(TEST_CRON_SECRET), ...POST });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0 });
    });
  });

  it('rejects a call without the cron secret and expires nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const parents = await seedSubscriptionParents(tx);
      const [subscription] = await insertSubscription(tx, parents, { createdAt: ABANDONED_AT }).returning();
      if (subscription === undefined) throw new Error('subscription insert returned no row');

      const res = await testApp(tx).request(HOUSEKEEPING_PATH, POST);

      expect(res.status).toBe(401);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
      });
    });
  });
});
