import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END, seedRenewing, seedRenewings } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const ONE_HOUR_MS = 60 * 60 * 1000;
const NEXT_RUN = new Date(PERIOD_END.getTime() + ONE_HOUR_MS);
const KMS_DOWN = 'kms unavailable';
const SMALL_BATCH = 2;
const BACKLOG = 3;
const NOTHING_DONE = { processed: 0, failed: 0 };

describe('runRenewal: the charge goes through the pinned connection (ADR 0010 decision 2)', () => {
  it("charges through the subscription's connection after its tenant switched to another one", async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedRenewing(tx);
      const replacement = await seedConnection(tx, ctx.organizationId);
      await tx
        .update(tenantsTable)
        .set({ providerConnectionId: replacement.providerConnectionId })
        .where(eq(tenantsTable.tenantId, ctx.tenantId));
      const original = providers.providerOf(ctx.providerConnectionId);
      original.scriptCharge(RENEWAL_SUCCEEDED);

      await renewWith(tx, providers.providerFor)(PERIOD_END);

      expect(original.calls.charge).toHaveLength(1);
      expect(providers.providerOf(replacement.providerConnectionId).calls.charge).toEqual([]);
    });
  });
});

describe('runRenewal: an unknown outcome is never retried as a new charge (ADR 0008)', () => {
  it('leaves the charge pending, the subscription active, and no event when the provider times out', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx, subscription } = await seedRenewing(tx);
      providers.providerOf(ctx.providerConnectionId).failCharges();

      expect(await renewWith(tx, providers.providerFor)(PERIOD_END)).toEqual({ processed: 0, failed: 1 });

      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING }),
      ]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
      });
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([]);
    });
  });

  it('never charges that period again on later runs while its charge is pending', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx } = await seedRenewing(tx);
      const provider = providers.providerOf(ctx.providerConnectionId);
      provider.failCharges();
      const renew = renewWith(tx, providers.providerFor);

      await renew(PERIOD_END);
      expect(await renew(NEXT_RUN)).toEqual(NOTHING_DONE);

      expect(provider.calls.charge).toHaveLength(1);
    });
  });
});

describe('runRenewal: one subscription cannot stop the batch', () => {
  it('writes nothing for a subscription whose provider cannot be built, and renews the others', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedRenewing(tx);
      const healthy = await seedRenewing(tx, {}, GLOBEX);
      providers.providerOf(healthy.ctx.providerConnectionId).scriptCharge(RENEWAL_SUCCEEDED);
      const kmsDownForBroken: ProviderFor = async (connection) =>
        connection.providerConnectionId === broken.ctx.providerConnectionId
          ? Promise.reject(new Error(KMS_DOWN))
          : providers.providerFor(connection);

      expect(await renewWith(tx, kmsDownForBroken)(PERIOD_END)).toEqual({ processed: 1, failed: 1 });

      expect(await chargesOf(tx, broken.subscription.subscriptionId)).toEqual([]);
      expect(await subscriptionRow(tx, healthy.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
      expect(await chargesOf(tx, healthy.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED }),
      ]);
    });
  });
});

describe('runRenewal: batch limit (ADR 0013)', () => {
  it('renews at most the batch limit per run and leaves the rest for the next run', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx, renewings } = await seedRenewings(tx, BACKLOG);
      const provider = providers.providerOf(ctx.providerConnectionId);
      renewings.forEach(() => provider.scriptCharge(RENEWAL_SUCCEEDED));
      const renew = renewWith(tx, providers.providerFor, SMALL_BATCH);

      expect(await renew(PERIOD_END)).toEqual({ processed: SMALL_BATCH, failed: 0 });
      expect(await renew(NEXT_RUN)).toEqual({ processed: BACKLOG - SMALL_BATCH, failed: 0 });
      expect(await renew(NEXT_RUN)).toEqual(NOTHING_DONE);

      const charged = await tx.select({ subscriptionId: chargesTable.subscriptionId }).from(chargesTable);
      expect(new Set(charged.map(({ subscriptionId }) => subscriptionId))).toEqual(
        new Set(renewings.map(({ subscription }) => subscription.subscriptionId)),
      );
    });
  });
});
