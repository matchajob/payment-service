import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, FIRST_RETRY_DAY } from '@tests/utils/dunning-days';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { seedRenewing } from '@tests/utils/renewal-rows';

const ONE_MS = 1;
const LATER = dunningDay(FIRST_RETRY_DAY + 1);
const NOTHING_DONE = { processed: 0, failed: 0 };

const setup = async (tx: Database, seed: (tx: Database) => ReturnType<typeof seedPastDue>) => {
  const providers = fakeProviderFactory();
  const { ctx } = await seed(tx);
  const provider = providers.providerOf(ctx.providerConnectionId);
  provider.scriptCharge(RENEWAL_SUCCEEDED);
  return { provider, dun: dunWith(tx, providers.providerFor) };
};

describe('runDunning: due detection (S1 r10, ADR 0014)', () => {
  it('does not retry before nextRetryAt', async () => {
    await withRollback(testDb(), async (tx) => {
      const { provider, dun } = await setup(tx, (db) => seedPastDue(db));
      expect(await dun(new Date(dunningDay(FIRST_RETRY_DAY).getTime() - ONE_MS))).toEqual(NOTHING_DONE);
      expect(provider.calls.charge).toEqual([]);
    });
  });

  it('retries at nextRetryAt', async () => {
    await withRollback(testDb(), async (tx) => {
      const { provider, dun } = await setup(tx, (db) => seedPastDue(db));
      expect(await dun(dunningDay(FIRST_RETRY_DAY))).toEqual({ processed: 1, failed: 0 });
      expect(provider.calls.charge).toHaveLength(1);
    });
  });

  it.each([
    ['an active subscription whose period ended, which renewal handles', (db: Database) => seedRenewing(db)],
    [
      'a canceled subscription',
      (db: Database) =>
        seedRenewing(db, { status: SUBSCRIPTION_STATUS.CANCELED, dunningStartedAt: null, nextRetryAt: null }),
    ],
    [
      'a store-billed past_due subscription',
      (db: Database) => seedPastDue(db, { scheduleOwner: SCHEDULE_OWNER.EXTERNAL }),
    ],
  ])('ignores %s', async (_, seed) => {
    await withRollback(testDb(), async (tx) => {
      const { provider, dun } = await setup(tx, seed);
      expect(await dun(LATER)).toEqual(NOTHING_DONE);
      expect(provider.calls.charge).toEqual([]);
    });
  });
});
