import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, FIRST_RETRY_DAY, SECOND_RETRY_DAY } from '@tests/utils/dunning-days';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const RETRY_AT = dunningDay(FIRST_RETRY_DAY);
const MUCH_LATER = dunningDay(SECOND_RETRY_DAY);
const SMALL_BATCH = 1;
const NOTHING_DONE = { processed: 0, failed: 0 };

describe('runDunning: an unknown outcome is never retried as a new charge (ADR 0008)', () => {
  it('leaves the charge pending, the subscription past_due with its retry unchanged, and no event', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx, subscription, history } = await seedPastDue(tx);
      providers.providerOf(ctx.providerConnectionId).failCharges();

      expect(await dunWith(tx, providers.providerFor)(RETRY_AT)).toEqual({ processed: 0, failed: 1 });

      expect(await chargesAfterHistory(tx, { subscription, history })).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING }),
      ]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        nextRetryAt: RETRY_AT,
      });
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([]);
    });
  });

  it('never charges that attempt again on later runs while its charge is pending', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedPastDue(tx);
      const provider = providers.providerOf(ctx.providerConnectionId);
      provider.failCharges();
      const dun = dunWith(tx, providers.providerFor);

      await dun(RETRY_AT);
      expect(await dun(MUCH_LATER)).toEqual(NOTHING_DONE);
      expect(provider.calls.charge).toHaveLength(1);
    });
  });
});

describe('runDunning: the retry goes through the pinned connection (ADR 0010 decision 2)', () => {
  it("retries through the subscription's connection after its tenant switched to another one", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedPastDue(tx);
      const replacement = await seedConnection(tx, ctx.organizationId);
      await tx
        .update(tenantsTable)
        .set({ providerConnectionId: replacement.providerConnectionId })
        .where(eq(tenantsTable.tenantId, ctx.tenantId));
      const original = providers.providerOf(ctx.providerConnectionId);
      original.scriptCharge(RENEWAL_SUCCEEDED);

      await dunWith(tx, providers.providerFor)(RETRY_AT);

      expect(original.calls.charge).toHaveLength(1);
      expect(providers.providerOf(replacement.providerConnectionId).calls.charge).toEqual([]);
    });
  });
});

describe('runDunning: batch limit (ADR 0013, ADR 0014)', () => {
  it('retries at most the batch limit per run and leaves the rest for the next run', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const first = await seedPastDue(tx);
      const second = await seedPastDue(tx, {}, GLOBEX);
      const pastDues = [first, second];
      pastDues.forEach(({ ctx }) => providers.providerOf(ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED));
      const dun = dunWith(tx, providers.providerFor, SMALL_BATCH);

      expect(await dun(RETRY_AT)).toEqual({ processed: SMALL_BATCH, failed: 0 });
      expect(await dun(RETRY_AT)).toEqual({ processed: SMALL_BATCH, failed: 0 });
      expect(await dun(RETRY_AT)).toEqual(NOTHING_DONE);
      expect(await tx.$count(chargesTable, eq(chargesTable.kind, CHARGE_KIND.RETRY))).toBe(pastDues.length);
      pastDues.forEach(({ ctx }) =>
        expect(providers.providerOf(ctx.providerConnectionId).calls.charge).toHaveLength(1),
      );
    });
  });
});
