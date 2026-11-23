import { describe, expect, it } from 'vitest';
import { subscriptionListResponseSchema } from '@/contract/subscription-list-response';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { withQuery } from '@tests/utils/list-query';
import { SUBSCRIPTIONS_PATH } from '@tests/utils/paths';
import { addRenewing, seedRenewing, seedRenewings } from '@tests/utils/renewal-rows';
import { testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const PAGE_SIZE = 2;
const SUBSCRIPTION_COUNT = 3;
const OVER_MAX_LIMIT = 101;
const UNKNOWN_STATUS = 'paused';

type Page = { data: { subscriptionId: string }[]; hasMore: boolean };

describe('GET /v1/subscriptions (dashboard slice 1)', () => {
  it("lists the calling tenant's subscriptions as the same snapshot GET /:id returns, and nobody else's", async () => {
    await withRollback(testDb(), async (tx) => {
      await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const res = await testApp(tx).request(SUBSCRIPTIONS_PATH, bearer(ours.ctx.apiKey));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(subscriptionListResponseSchema.parse(body)).toEqual(body);
      expect(body.hasMore).toBe(false);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        subscriptionId: ours.subscription.subscriptionId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        entitled: true,
      });
    });
  });

  it('filters by status', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const canceled = await addRenewing(tx, active.ctx, 1, { status: SUBSCRIPTION_STATUS.CANCELED });
      const res = await testApp(tx).request(
        withQuery(SUBSCRIPTIONS_PATH, { status: SUBSCRIPTION_STATUS.CANCELED }),
        bearer(active.ctx.apiKey),
      );
      const body: Page = await res.json();
      expect(body.data.map((s) => s.subscriptionId)).toEqual([canceled.subscription.subscriptionId]);
    });
  });

  it('pages with limit and startingAfter, returning every subscription exactly once', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, renewings } = await seedRenewings(tx, SUBSCRIPTION_COUNT);
      const app = testApp(tx);
      const first: Page = await (
        await app.request(withQuery(SUBSCRIPTIONS_PATH, { limit: PAGE_SIZE }), bearer(ctx.apiKey))
      ).json();
      const last = first.data.at(-1)?.subscriptionId ?? '';
      const second: Page = await (
        await app.request(withQuery(SUBSCRIPTIONS_PATH, { limit: PAGE_SIZE, startingAfter: last }), bearer(ctx.apiKey))
      ).json();
      expect(first.data).toHaveLength(PAGE_SIZE);
      expect(first.hasMore).toBe(true);
      expect(second.hasMore).toBe(false);
      const seen = [...first.data, ...second.data].map((s) => s.subscriptionId);
      expect(seen.toSorted()).toEqual(renewings.map((r) => r.subscription.subscriptionId).toSorted());
    });
  });

  it.each([
    ['a limit above the maximum', { limit: OVER_MAX_LIMIT }],
    ['an unknown status', { status: UNKNOWN_STATUS }],
  ])('answers 400 for %s', async (_, query) => {
    await withRollback(testDb(), async (tx) => {
      const { ctx } = await seedRenewing(tx);
      const res = await testApp(tx).request(withQuery(SUBSCRIPTIONS_PATH, query), bearer(ctx.apiKey));
      expect(res.status).toBe(400);
    });
  });

  it("answers 400 when startingAfter is another tenant's subscription, so a cursor leaks nothing", async () => {
    await withRollback(testDb(), async (tx) => {
      const theirs = await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const res = await testApp(tx).request(
        withQuery(SUBSCRIPTIONS_PATH, { startingAfter: theirs.subscription.subscriptionId }),
        bearer(ours.ctx.apiKey),
      );
      expect(res.status).toBe(400);
    });
  });
});
