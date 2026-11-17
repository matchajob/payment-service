import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { DUN_PATH, HOUSEKEEPING_PATH, RECONCILE_PATH, RENEW_PATH } from '@tests/utils/paths';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { providerDownFor } from '@tests/utils/provider-down-for';
import { HOUR_MS } from '@tests/utils/reconcile-times';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import { TEST_CRON_TOKEN } from '@tests/utils/fake-cron-token-verifier';
import { TEST_NOW, testApp } from '@tests/utils/test-app';

const INTERNAL_SERVER_ERROR = 500;
const POST = { method: 'POST' } as const;
const AN_HOUR_AGO = new Date(TEST_NOW.getTime() - HOUR_MS);
const CHECKOUT_TTL_HOURS = 12;
const ABANDONED_AT = new Date(TEST_NOW.getTime() - CHECKOUT_TTL_HOURS * HOUR_MS);
const SESSION_REF = 'checkout-session-1';
const ONE_FAILED = { processed: 0, failed: 1 };

type DownConnection = (tx: Database) => Promise<ProviderConnection['providerConnectionId']>;

const cronWithProviderDown = async (tx: Database, path: string, seed: DownConnection) => {
  const providers = fakeProviderFactory();
  const providerFor: ProviderFor = providerDownFor(providers, await seed(tx));
  return testApp(tx, { providerFor }).request(path, { ...bearer(TEST_CRON_TOKEN), ...POST });
};

describe('charge crons answer 500 when an item failed, so Scheduler marks the run failed (code-review-1 M11)', () => {
  it.each([
    [
      'renew',
      RENEW_PATH,
      async (tx: Database) => (await seedRenewing(tx, { currentPeriodEnd: TEST_NOW })).ctx.providerConnectionId,
      ONE_FAILED,
    ],
    [
      'dun',
      DUN_PATH,
      async (tx: Database) =>
        (await seedPastDue(tx, { currentPeriodEnd: TEST_NOW, dunningStartedAt: TEST_NOW, nextRetryAt: TEST_NOW })).ctx
          .providerConnectionId,
      ONE_FAILED,
    ],
    [
      'reconcile',
      RECONCILE_PATH,
      async (tx: Database) => (await seedPendingRenewal(tx, { attemptedAt: AN_HOUR_AGO })).ctx.providerConnectionId,
      { ...ONE_FAILED, flagged: 0 },
    ],
    [
      'housekeeping',
      HOUSEKEEPING_PATH,
      async (tx: Database) => {
        const parents = await seedSubscriptionParents(tx);
        await insertSubscription(tx, parents, { createdAt: ABANDONED_AT, checkoutSessionRef: SESSION_REF });
        return parents.providerConnectionId;
      },
      ONE_FAILED,
    ],
  ] as const)('%s', async (_, path, seed, summary) => {
    await withRollback(testDb(), async (tx) => {
      const res = await cronWithProviderDown(tx, path, seed);
      expect(res.status).toBe(INTERNAL_SERVER_ERROR);
      expect(await res.json()).toEqual(summary);
    });
  });
});
