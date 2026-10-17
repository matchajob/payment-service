import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { housekeepWith } from '@tests/utils/housekeeping-run';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { insertSubscription, PERIOD_END, seedSubscriptionParents } from '@tests/utils/subscription-rows';

const CREATED_AT = new Date('2026-01-15T10:00:00.000Z');
const DEFAULT_TTL_HOURS = 12;
const SHORT_TTL_HOURS = 2;
const ELEVEN_HOURS = 11;
const ANCHOR_DAY = 15;
const SMALL_BATCH = 1;
const WEST_OF_UTC = 'America/New_York';
const EXPIRED = after(CREATED_AT, DEFAULT_TTL_HOURS * HOUR_MS);
const NOT_YET = after(CREATED_AT, ELEVEN_HOURS * HOUR_MS);
const NOTHING_DONE = { processed: 0, failed: 0 };

type Overrides = Parameters<typeof insertSubscription>[2];

const seedCheckout = async (tx: Database, overrides: Overrides = {}) => {
  const parents = await seedSubscriptionParents(tx);
  const [subscription] = await insertSubscription(tx, parents, { createdAt: CREATED_AT, ...overrides }).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  return { parents, subscription };
};

describe('runHousekeeping: an abandoned checkout (S1 r3)', () => {
  it('cancels a checkout 12h old with reason checkout_expired', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription } = await seedCheckout(tx);

      expect(await housekeepWith(tx)(EXPIRED)).toEqual({ processed: 1, failed: 0 });

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        canceledAt: EXPIRED,
        cancelReason: CANCEL_REASON.CHECKOUT_EXPIRED,
      });
    });
  });

  it('leaves a checkout 11h old', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription } = await seedCheckout(tx);

      expect(await housekeepWith(tx)(NOT_YET)).toEqual(NOTHING_DONE);

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
      });
    });
  });

  it('emits no event: the tenant never saw this subscription become anything', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription } = await seedCheckout(tx);

      await housekeepWith(tx)(EXPIRED);

      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([]);
    });
  });

  it('compares instants, not wall clocks, when the database session is not in UTC', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription } = await seedCheckout(tx);
      await tx.execute(sql.raw(`set local time zone '${WEST_OF_UTC}'`));

      expect(await housekeepWith(tx)(NOT_YET)).toEqual(NOTHING_DONE);

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
      });
    });
  });

  it("uses the tenant's own checkoutTtlHours", async () => {
    await withRollback(testDb(), async (tx) => {
      const { parents, subscription } = await seedCheckout(tx);
      await tx
        .update(tenantsTable)
        .set({ checkoutTtlHours: SHORT_TTL_HOURS })
        .where(eq(tenantsTable.tenantId, parents.tenantId));

      await housekeepWith(tx)(after(CREATED_AT, SHORT_TTL_HOURS * HOUR_MS));

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
      });
    });
  });

  it('touches only incomplete subscriptions', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription } = await seedCheckout(tx, {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
        anchorDay: ANCHOR_DAY,
      });

      expect(await housekeepWith(tx)(EXPIRED)).toEqual(NOTHING_DONE);

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
    });
  });

  it('expires at most the batch limit per run, oldest first', async () => {
    await withRollback(testDb(), async (tx) => {
      const { parents, subscription: older } = await seedCheckout(tx);
      const [newer] = await insertSubscription(tx, parents, { createdAt: after(CREATED_AT, HOUR_MS) }).returning();
      if (newer === undefined) throw new Error('subscription insert returned no row');
      const housekeep = housekeepWith(tx, SMALL_BATCH);
      const bothExpired = after(EXPIRED, HOUR_MS);

      expect(await housekeep(bothExpired)).toEqual({ processed: 1, failed: 0 });
      expect(await subscriptionRow(tx, older.subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.CANCELED });
      expect(await subscriptionRow(tx, newer.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
      });

      expect(await housekeep(bothExpired)).toEqual({ processed: 1, failed: 0 });
      expect(await subscriptionRow(tx, newer.subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.CANCELED });
    });
  });
});
