import { afterAll, describe, expect, it } from 'vitest';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { testDb } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedPendingRenewals } from '@tests/utils/pending-charge-rows';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { NEXT_PERIOD_END } from '@tests/utils/renewal-rows';
import { truncateModeDb } from '@tests/utils/truncate-mode';
import { VERIFIED_SUCCEEDED } from '@tests/utils/verified-charge-fixtures';

const PENDING_COUNT = 10;
const RUNS = 2;
const AN_HOUR_LATER = after(RENEWAL_ATTEMPTED_AT, HOUR_MS);

describe('runReconcile: concurrency (ADR 0002 double-fire, ADR 0017)', () => {
  const db = truncateModeDb();
  const secondInstance = testDb();
  afterAll(() => secondInstance.$client.end());

  it('two runs at once on separate connections settle each charge exactly once', async () => {
    const providers = fakeProviderFactory();
    const pendings = await seedPendingRenewals(db, PENDING_COUNT);
    const [first] = pendings;
    if (first === undefined) throw new Error('no pending charge seeded');
    const provider = providers.providerOf(first.ctx.providerConnectionId);
    Array.from({ length: PENDING_COUNT * RUNS }).forEach(() => provider.scriptVerify(VERIFIED_SUCCEEDED));

    const [one, two] = await Promise.all([
      reconcileWith(db, providers.providerFor)(AN_HOUR_LATER),
      reconcileWith(secondInstance, providers.providerFor)(AN_HOUR_LATER),
    ]);

    expect(one.processed + two.processed).toBe(PENDING_COUNT);
    expect(one.failed + two.failed).toBe(0);
    expect(await db.$count(outboxEventsTable)).toBe(PENDING_COUNT);
    const periodEnds = await db.select({ end: subscriptionsTable.currentPeriodEnd }).from(subscriptionsTable);
    expect(periodEnds).toEqual(Array.from({ length: PENDING_COUNT }, () => ({ end: NEXT_PERIOD_END })));
  });
});
