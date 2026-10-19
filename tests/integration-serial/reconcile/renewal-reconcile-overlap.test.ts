import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { testDb } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedPendingRenewals } from '@tests/utils/pending-charge-rows';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { NEXT_PERIOD_END } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { truncateModeDb } from '@tests/utils/truncate-mode';
import { VERIFIED_SUCCEEDED } from '@tests/utils/verified-charge-fixtures';

const PENDING_COUNT = 10;
const NONE_SEEDED = 'no pending charge seeded';
const AN_HOUR_LATER = after(RENEWAL_ATTEMPTED_AT, HOUR_MS);

describe('runRenewal and runReconcile at once on pending renewals (ADR 0008, ADR 0017)', () => {
  const db = truncateModeDb();
  const secondInstance = testDb();
  afterAll(() => secondInstance.$client.end());

  it('renewal charges nothing while reconcile settles each pending charge exactly once', async () => {
    const providers = fakeProviderFactory();
    const pendings = await seedPendingRenewals(db, PENDING_COUNT);
    const [first] = pendings;
    if (first === undefined) throw new Error(NONE_SEEDED);
    const provider = providers.providerOf(first.ctx.providerConnectionId);
    pendings.forEach(() => provider.scriptVerify(VERIFIED_SUCCEEDED));

    const [renewed, reconciled] = await Promise.all([
      renewWith(db, providers.providerFor)(AN_HOUR_LATER),
      reconcileWith(secondInstance, providers.providerFor)(AN_HOUR_LATER),
    ]);

    expect(renewed).toEqual({ processed: 0, failed: 0 });
    expect(reconciled).toEqual({ processed: PENDING_COUNT, failed: 0, flagged: 0 });
    expect(provider.calls.charge).toEqual([]);
    expect(provider.calls.verifyCharge).toHaveLength(PENDING_COUNT);
    const renewals = await db
      .select({ status: chargesTable.status })
      .from(chargesTable)
      .where(eq(chargesTable.kind, CHARGE_KIND.RENEWAL));
    expect(renewals).toEqual(pendings.map(() => ({ status: CHARGE_STATUS.SUCCEEDED })));
    expect(await db.$count(outboxEventsTable)).toBe(PENDING_COUNT);
    const periodEnds = await db.select({ end: subscriptionsTable.currentPeriodEnd }).from(subscriptionsTable);
    expect(periodEnds).toEqual(pendings.map(() => ({ end: NEXT_PERIOD_END })));
  });

  it('a renewal run right after reconcile settled does not charge the period again', async () => {
    const providers = fakeProviderFactory();
    const pendings = await seedPendingRenewals(db, PENDING_COUNT);
    const [first] = pendings;
    if (first === undefined) throw new Error(NONE_SEEDED);
    const provider = providers.providerOf(first.ctx.providerConnectionId);
    pendings.forEach(() => provider.scriptVerify(VERIFIED_SUCCEEDED));
    await reconcileWith(secondInstance, providers.providerFor)(AN_HOUR_LATER);

    expect(await renewWith(db, providers.providerFor)(AN_HOUR_LATER)).toEqual({ processed: 0, failed: 0 });

    expect(provider.calls.charge).toEqual([]);
  });
});
