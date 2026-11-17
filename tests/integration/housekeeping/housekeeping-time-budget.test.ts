import { describe, expect, it } from 'vitest';
import { HOUSEKEEPING_BATCH_LIMIT } from '@/lib/housekeeping/housekeeping-batch-limit';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { housekeepWith } from '@tests/utils/housekeeping-run';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import { ALWAYS_TIME_UP } from '@tests/utils/time-up-fixtures';

const CHECKOUT_TTL_HOURS = 12;
const CREATED_AT = new Date('2026-01-15T10:00:00.000Z');
const CHECKOUT_EXPIRED = after(CREATED_AT, CHECKOUT_TTL_HOURS * HOUR_MS);
const NOTHING_DONE = { processed: 0, failed: 0 };
const ONE_DONE = { processed: 1, failed: 0 };

describe('runHousekeeping: time budget (code-review-1 M11, ADR 0026)', () => {
  it('expires nothing once time is up and leaves the checkout for the next run', async () => {
    await withRollback(testDb(), async (tx) => {
      const parents = await seedSubscriptionParents(tx);
      await insertSubscription(tx, parents, { createdAt: CREATED_AT });

      expect(
        await housekeepWith(
          tx,
          HOUSEKEEPING_BATCH_LIMIT,
          fakeProviderFactory().providerFor,
          ALWAYS_TIME_UP,
        )(CHECKOUT_EXPIRED),
      ).toEqual(NOTHING_DONE);
      expect(await housekeepWith(tx)(CHECKOUT_EXPIRED)).toEqual(ONE_DONE);
    });
  });
});
