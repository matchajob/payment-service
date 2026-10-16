import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { seedBillingContext, type BillingContext } from '@tests/utils/billing-context';
import { startTestCheckout } from '@tests/utils/checkout-flow';
import { seedConnection, type SeededConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const SESSION_1 = 'session-1';
const SESSION_2 = 'session-2';
const SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: 'charge-1' } as const;

const subscriptionRow = async (db: Database, subscriptionId: Subscription['subscriptionId']) => {
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.subscriptionId, subscriptionId));
  if (row === undefined) throw new Error('subscription not found');
  return row;
};

const switchConnection = (db: Database, ctx: BillingContext, to: SeededConnection) =>
  db
    .update(tenantsTable)
    .set({ providerConnectionId: to.providerConnectionId })
    .where(eq(tenantsTable.tenantId, ctx.tenantId));

const setup = async (tx: Database) => {
  const ctx = await seedBillingContext(tx);
  const providers = fakeProviderFactory();
  const app = testApp(tx, { providerFor: providers.providerFor });
  const complete = (subscriptionId: string, sessionRef: string, connection: SeededConnection = ctx) =>
    app.request(
      webhookPath(connection.providerConnectionId),
      postWebhook(fakeCheckoutCompletedBody(subscriptionId, sessionRef)),
    );
  return { ctx, providers, app, complete };
};

describe('a subscription pins its provider connection (ADR 0010 decision 2)', () => {
  it("is created on its tenant's connection, and checkout starts there and nowhere else", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, providers, app } = await setup(tx);
      const sibling = await seedConnection(tx, ctx.organizationId);
      const subscriptionId = await startTestCheckout(app, ctx);
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        providerConnectionId: ctx.providerConnectionId,
      });
      expect(providers.providerOf(ctx.providerConnectionId).calls.startCheckout).toHaveLength(1);
      expect(providers.providerOf(sibling.providerConnectionId).calls.startCheckout).toEqual([]);
    });
  });

  it('keeps its connection after the tenant switches to another one', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, app } = await setup(tx);
      const subscriptionId = await startTestCheckout(app, ctx);
      await switchConnection(tx, ctx, await seedConnection(tx, ctx.organizationId));
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        providerConnectionId: ctx.providerConnectionId,
      });
    });
  });

  it('never presents the token to the new connection: charge #1 still runs through the one that captured it', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, providers, app, complete } = await setup(tx);
      const subscriptionId = await startTestCheckout(app, ctx);
      const replacement = await seedConnection(tx, ctx.organizationId);
      await switchConnection(tx, ctx, replacement);
      const original = providers.providerOf(ctx.providerConnectionId);
      original.scriptCharge(SUCCEEDED);

      expect((await complete(subscriptionId, SESSION_1)).status).toBe(200);

      expect(original.calls.verifyCheckout).toEqual([SESSION_1]);
      expect(original.calls.charge).toHaveLength(1);
      const newer = providers.providerOf(replacement.providerConnectionId);
      expect([newer.calls.verifyCheckout, newer.calls.charge]).toEqual([[], []]);
      expect(await tx.select().from(paymentMethodsTable)).toEqual([
        expect.objectContaining({ subscriptionId, providerConnectionId: ctx.providerConnectionId }),
      ]);
      expect(await tx.select().from(chargesTable)).toEqual([
        expect.objectContaining({ subscriptionId, providerConnectionId: ctx.providerConnectionId }),
      ]);
    });
  });

  it('starts new subscriptions on the new connection once the tenant has switched', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, providers, app } = await setup(tx);
      const replacement = await seedConnection(tx, ctx.organizationId);
      await switchConnection(tx, ctx, replacement);
      const subscriptionId = await startTestCheckout(app, ctx);
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        providerConnectionId: replacement.providerConnectionId,
      });
      expect(providers.providerOf(replacement.providerConnectionId).calls.startCheckout).toHaveLength(1);
      expect(providers.providerOf(ctx.providerConnectionId).calls.startCheckout).toEqual([]);
    });
  });

  it('ignores a checkout posted to a connection the subscription is not pinned to', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, providers, app, complete } = await setup(tx);
      const subscriptionId = await startTestCheckout(app, ctx);
      const unrelated = await seedConnection(tx);
      expect((await complete(subscriptionId, SESSION_1, unrelated)).status).toBe(200);
      expect(providers.providerOf(unrelated.providerConnectionId).calls.verifyCheckout).toEqual([]);
      expect(providers.providerOf(ctx.providerConnectionId).calls.verifyCheckout).toEqual([]);
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.INCOMPLETE });
    });
  });
});

describe('two applications of one organization share one merchant account (slice 19 delivers)', () => {
  it('charges both through the shared connection, and each subscription belongs to its own tenant', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx: acme, providers, app, complete } = await setup(tx);
      const globex = await seedBillingContext(tx, GLOBEX, acme);
      const acmeSubscription = await startTestCheckout(app, acme);
      const globexSubscription = await startTestCheckout(app, globex);
      const shared = providers.providerOf(acme.providerConnectionId);
      shared.scriptCharge(SUCCEEDED);
      shared.scriptCharge(SUCCEEDED);

      await complete(acmeSubscription, SESSION_1);
      await complete(globexSubscription, SESSION_2);

      expect(shared.calls.charge).toHaveLength(2);
      expect(await subscriptionRow(tx, acmeSubscription)).toMatchObject({
        tenantId: acme.tenantId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
      expect(await subscriptionRow(tx, globexSubscription)).toMatchObject({
        tenantId: globex.tenantId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
    });
  });
});
