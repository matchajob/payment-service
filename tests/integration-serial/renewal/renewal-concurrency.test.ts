import { afterAll, describe, expect, it } from 'vitest';
import { chargesTable } from '@/lib/charges/schema';
import { testDb } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { PERIOD_END, seedRenewings } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const DUE_COUNT = 10;

describe('runRenewal: concurrency (Spec 1 double-charge guards, ADR 0002 double-fire)', () => {
  const db = truncateModeDb();
  const secondInstance = testDb();
  afterAll(() => secondInstance.$client.end());

  it('two runs at once on separate connections charge each due subscription exactly once', async () => {
    const providers = fakeProviderFactory();
    const { ctx, renewings } = await seedRenewings(db, DUE_COUNT);
    const provider = providers.providerOf(ctx.providerConnectionId);
    renewings.forEach(() => provider.scriptCharge(RENEWAL_SUCCEEDED));

    const [first, second] = await Promise.all([
      renewWith(db, providers.providerFor)(PERIOD_END),
      renewWith(secondInstance, providers.providerFor)(PERIOD_END),
    ]);

    expect(first.processed + second.processed).toBe(DUE_COUNT);
    expect(first.failed + second.failed).toBe(0);
    expect(provider.calls.charge).toHaveLength(DUE_COUNT);
    expect(new Set(provider.calls.charge.map(({ dedupKey }) => dedupKey)).size).toBe(DUE_COUNT);
    expect(await db.$count(chargesTable)).toBe(DUE_COUNT);
  });
});
