import { afterAll, describe, expect, it } from 'vitest';
import { chargesTable } from '@/lib/charges/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb } from '@tests/utils/db';
import { dunningDay, FIRST_RETRY_DAY } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { seedRenewings } from '@tests/utils/renewal-rows';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const DUE_COUNT = 10;
const RETRY_AT = dunningDay(FIRST_RETRY_DAY);

describe('runDunning: concurrency (Spec 1 double-charge guards, ADR 0002 double-fire)', () => {
  const db = truncateModeDb();
  const secondInstance = testDb();
  afterAll(() => secondInstance.$client.end());

  it('two runs at once on separate connections retry each due subscription exactly once', async () => {
    const providers = fakeProviderFactory();
    const { ctx, renewings } = await seedRenewings(db, DUE_COUNT, {
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      nextRetryAt: RETRY_AT,
    });
    const provider = providers.providerOf(ctx.providerConnectionId);
    renewings.forEach(() => provider.scriptCharge(RENEWAL_SUCCEEDED));

    const [first, second] = await Promise.all([
      dunWith(db, providers.providerFor)(RETRY_AT),
      dunWith(secondInstance, providers.providerFor)(RETRY_AT),
    ]);

    expect(first.processed + second.processed).toBe(DUE_COUNT);
    expect(first.failed + second.failed).toBe(0);
    expect(new Set(provider.calls.charge.map(({ dedupKey }) => dedupKey)).size).toBe(DUE_COUNT);
    expect(await db.$count(chargesTable)).toBe(DUE_COUNT);
  });
});
