import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { after, HOUR_MS, IN_FLIGHT_MS, MINUTE_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_AFTER_NEXT_END, PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { cancelPath, postNoBody } from '@tests/utils/subscription-api';
import { GLOBEX } from '@tests/utils/tenant-fixtures';
import { testApp } from '@tests/utils/test-app';
import { VERIFIED_SUCCEEDED } from '@tests/utils/verified-charge-fixtures';

const AN_HOUR_LATER = after(RENEWAL_ATTEMPTED_AT, HOUR_MS);
const STILL_IN_FLIGHT = after(RENEWAL_ATTEMPTED_AT, IN_FLIGHT_MS - MINUTE_MS);
const NOTHING_DONE = { processed: 0, failed: 0, flagged: 0 };

describe('runReconcile: a charge whose call may still be running (ADR 0017 decision 3)', () => {
  it('does not ask about a charge attempted less than 15 minutes ago', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      const provider = providers.providerOf(pending.ctx.providerConnectionId);

      expect(await reconcileWith(tx, providers.providerFor)(STILL_IN_FLIGHT)).toEqual(NOTHING_DONE);

      expect(provider.calls.verifyCharge).toEqual([]);
    });
  });

  it('asks once 15 minutes have passed', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      const provider = providers.providerOf(pending.ctx.providerConnectionId);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      await reconcileWith(tx, providers.providerFor)(after(RENEWAL_ATTEMPTED_AT, IN_FLIGHT_MS));

      expect(provider.calls.verifyCharge).toHaveLength(1);
    });
  });
});

describe('runReconcile: a provider error (ADR 0017)', () => {
  it('leaves that charge pending and still settles the others in the run', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const broken = await seedPendingRenewal(tx);
      const healthy = await seedPendingRenewal(tx, {}, GLOBEX);
      providers.providerOf(broken.ctx.providerConnectionId).failVerifies();
      providers.providerOf(healthy.ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcileWith(tx, providers.providerFor)(AN_HOUR_LATER)).toEqual({
        processed: 1,
        failed: 1,
        flagged: 0,
      });

      expect(await chargesOf(tx, broken.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING, reconcileFlag: null }),
      ]);
      expect(await chargesOf(tx, healthy.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED }),
      ]);
    });
  });
});

describe('runReconcile: the pinned connection (ADR 0010 decision 2)', () => {
  it('asks the connection that made the charge after its tenant switched to another one', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      const replacement = await seedConnection(tx, pending.ctx.organizationId);
      await tx
        .update(tenantsTable)
        .set({ providerConnectionId: replacement.providerConnectionId })
        .where(eq(tenantsTable.tenantId, pending.ctx.tenantId));
      providers.providerOf(pending.ctx.providerConnectionId).scriptVerify(VERIFIED_SUCCEEDED);

      await reconcileWith(tx, providers.providerFor)(AN_HOUR_LATER);

      expect(providers.providerOf(replacement.providerConnectionId).calls.verifyCharge).toEqual([]);
      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED }),
      ]);
    });
  });
});

describe('runReconcile: a settled charge unsticks the subscription (ADR 0013, slice 9)', () => {
  it('lets the next renewal charge the next period', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      const provider = providers.providerOf(pending.ctx.providerConnectionId);
      provider.scriptVerify(VERIFIED_SUCCEEDED);
      provider.scriptCharge(RENEWAL_SUCCEEDED);

      await reconcileWith(tx, providers.providerFor)(AN_HOUR_LATER);

      expect(await renewWith(tx, providers.providerFor)(NEXT_PERIOD_END)).toEqual({ processed: 1, failed: 0 });
      expect(provider.calls.charge).toEqual([
        expect.objectContaining({
          dedupKey: `${pending.subscription.subscriptionId}:${PERIOD_AFTER_NEXT_END.toISOString()}:0`,
        }),
      ]);
    });
  });

  it('lets the tenant cancel a subscription the timed-out renewal had blocked', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx, subscription } = await seedRenewing(tx);
      const provider = providers.providerOf(ctx.providerConnectionId);
      provider.failCharges();
      await renewWith(tx, providers.providerFor)(PERIOD_END);
      const cancel = () => testApp(tx).request(cancelPath(subscription.subscriptionId), postNoBody(ctx.apiKey));
      expect((await cancel()).status).toBe(409);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      await reconcileWith(tx, providers.providerFor)(AN_HOUR_LATER);

      expect((await cancel()).status).toBe(200);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: true,
      });
    });
  });
});
