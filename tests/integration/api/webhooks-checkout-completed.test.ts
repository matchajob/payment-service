import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import { createCustomer, CREATE_CUSTOMER_OUTCOME } from '@/lib/customers/create-customer';
import type { Database } from '@/lib/db';
import { CURRENCY } from '@/lib/money/currency';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { webhookEventsTable } from '@/lib/webhooks/schema';
import { seedBillingContext } from '@tests/utils/billing-context';
import { startTestCheckout } from '@tests/utils/checkout-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { TEST_NOW, testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const SESSION_1 = 'session-1';
const SESSION_2 = 'session-2';
const CHARGE_REF = 'charge-1';
const DECLINED = 'insufficient funds';
const PERIOD_1_END = new Date('2026-02-15T10:00:00.000Z');
const PERIOD_1_ANCHOR = 15;
const OTHER_EXTERNAL_REF = 'user-43';

type WebhookOverride = { sessionRef?: string; reference?: string };

const SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: CHARGE_REF };
const DECLINE = { outcome: CHARGE_STATUS.FAILED, providerChargeRef: undefined, reason: DECLINED };

const subscriptionRow = async (db: Database, subscriptionId: Subscription['subscriptionId']) => {
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.subscriptionId, subscriptionId));
  return row;
};

const setup = async (tx: Database) => {
  const ctx = await seedBillingContext(tx);
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(ctx.providerConnectionId);
  const app = testApp(tx, { providerFor: providers.providerFor });
  const subscriptionId = await startTestCheckout(app, ctx);
  const complete = (
    sessionRef = SESSION_1,
    reference: string = subscriptionId,
    connectionId: string = ctx.providerConnectionId,
  ) => app.request(webhookPath(connectionId), postWebhook(fakeCheckoutCompletedBody(reference, sessionRef)));
  return { ctx, provider, app, subscriptionId, complete };
};

describe('checkout completed webhook (S1 r2, ADR 0007, ADR 0008)', () => {
  describe('charge #1 succeeds', () => {
    it('activates with period 1 from now and the anchor day stored (Spec 2)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        expect((await complete()).status).toBe(200);
        expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
          status: SUBSCRIPTION_STATUS.ACTIVE,
          currentPeriodEnd: PERIOD_1_END,
          anchorDay: PERIOD_1_ANCHOR,
          sequence: 1,
        });
      });
    });

    it('verifies the checkout with the provider and charges the token it returned, never one from the payload', async () => {
      await withRollback(testDb(), async (tx) => {
        const { ctx, provider, subscriptionId, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        await complete();
        expect(provider.calls.verifyCheckout).toEqual([SESSION_1]);
        expect(provider.calls.charge).toEqual([
          {
            paymentMethodToken: `token-${SESSION_1}`,
            amountMinor: ctx.plan.amountMinor,
            currency: ctx.plan.currency,
            dedupKey: `${subscriptionId}:${PERIOD_1_END.toISOString()}:0`,
          },
        ]);
      });
    });

    it('stores the saved card and records charge #1 as succeeded with the amount from the plan row (Spec 4 rule 2)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { ctx, provider, subscriptionId, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        await complete();
        const cards = await tx.select().from(paymentMethodsTable);
        expect(cards).toEqual([
          expect.objectContaining({ subscriptionId, providerToken: `token-${SESSION_1}`, captureRef: SESSION_1 }),
        ]);
        expect(await tx.select().from(chargesTable)).toEqual([
          expect.objectContaining({
            subscriptionId,
            paymentMethodId: cards[0]?.paymentMethodId,
            kind: CHARGE_KIND.FIRST,
            periodEnd: PERIOD_1_END,
            attempt: 0,
            amountMinor: ctx.plan.amountMinor,
            currency: CURRENCY.ILS,
            status: CHARGE_STATUS.SUCCEEDED,
            providerChargeRef: CHARGE_REF,
            attemptedAt: TEST_NOW,
          }),
        ]);
      });
    });

    it('writes subscription.activated with the full snapshot and sequence 1, the first event the tenant sees (Spec 5)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { ctx, provider, subscriptionId, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        await complete();
        expect(await tx.select().from(outboxEventsTable)).toEqual([
          expect.objectContaining({
            subscriptionId,
            eventType: OUTBOUND_EVENT_TYPE.SUBSCRIPTION_ACTIVATED,
            sequence: 1,
            occurredAt: TEST_NOW,
            snapshot: {
              subscriptionId,
              customerId: ctx.customerId,
              customerExternalRef: 'user-42',
              planId: ctx.plan.planId,
              status: SUBSCRIPTION_STATUS.ACTIVE,
              entitled: true,
              currentPeriodEnd: PERIOD_1_END.toISOString(),
              cancelAtPeriodEnd: false,
              cancelReason: null,
              canceledAt: null,
            },
          }),
        ]);
      });
    });

    it('queues the event for the drainer: pending, never attempted, due at once (ADR 0009)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        await complete();
        expect(await tx.select().from(outboxEventsTable)).toEqual([
          expect.objectContaining({
            deliveryStatus: DELIVERY_STATUS.PENDING,
            attempts: 0,
            nextAttemptAt: TEST_NOW,
            deliveredAt: null,
            lastError: null,
          }),
        ]);
      });
    });

    it('marks the webhook processed', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        await complete();
        expect(await tx.select().from(webhookEventsTable)).toEqual([
          expect.objectContaining({ processedAt: TEST_NOW }),
        ]);
      });
    });

    it('processes a replayed webhook once: one charge, one event (Spec 4 rule 1)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, complete } = await setup(tx);
        provider.scriptCharge(SUCCEEDED);
        await complete();
        await complete();
        expect(provider.calls.charge).toHaveLength(1);
        expect(await tx.$count(outboxEventsTable)).toBe(1);
      });
    });
  });

  describe('charge #1 is declined (decided 2026-10-16)', () => {
    it('cancels the subscription, records the decline, and emits charge.failed with a canceled snapshot', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        provider.scriptCharge(DECLINE);
        expect((await complete()).status).toBe(200);
        expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceledAt: TEST_NOW,
          cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
        });
        expect(await tx.select().from(chargesTable)).toEqual([
          expect.objectContaining({ status: CHARGE_STATUS.FAILED, failureReason: DECLINED, providerChargeRef: null }),
        ]);
        expect(await tx.select().from(outboxEventsTable)).toEqual([
          expect.objectContaining({
            eventType: OUTBOUND_EVENT_TYPE.CHARGE_FAILED,
            sequence: 1,
            snapshot: expect.objectContaining({ status: SUBSCRIPTION_STATUS.CANCELED, entitled: false }),
          }),
        ]);
      });
    });
  });

  describe('charge #1 times out (ADR 0008: a timeout is not a failure)', () => {
    it('leaves the charge pending and the event unprocessed, and answers 5xx', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        provider.failCharges();
        expect((await complete()).status).toBe(500);
        expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.ACTIVE });
        expect(await tx.select().from(chargesTable)).toEqual([
          expect.objectContaining({ status: CHARGE_STATUS.PENDING, providerChargeRef: null, failureReason: null }),
        ]);
        expect(await tx.$count(outboxEventsTable)).toBe(0);
      });
    });

    it('never charges again when the provider retries the webhook; reconcile settles the pending charge', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, complete } = await setup(tx);
        provider.failCharges();
        await complete();
        const retry = await complete();
        expect(retry.status).toBe(200);
        expect(provider.calls.charge).toHaveLength(1);
        expect(await tx.$count(chargesTable)).toBe(1);
      });
    });
  });

  describe('two paid checkouts for one customer (ADR 0007)', () => {
    it('charges once: the second activation loses to the one-live index before any money moves', async () => {
      await withRollback(testDb(), async (tx) => {
        const { ctx, provider, app, subscriptionId, complete } = await setup(tx);
        const second = await startTestCheckout(app, ctx);
        provider.scriptCharge(SUCCEEDED);
        await complete(SESSION_1, subscriptionId);
        const res = await complete(SESSION_2, second);
        expect(res.status).toBe(200);
        expect(provider.calls.charge).toHaveLength(1);
        expect(await subscriptionRow(tx, second)).toMatchObject({
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceledAt: TEST_NOW,
          cancelReason: CANCEL_REASON.ALREADY_SUBSCRIBED,
        });
      });
    });

    it('tells the tenant why the second checkout did nothing', async () => {
      await withRollback(testDb(), async (tx) => {
        const { ctx, provider, app, subscriptionId, complete } = await setup(tx);
        const second = await startTestCheckout(app, ctx);
        provider.scriptCharge(SUCCEEDED);
        await complete(SESSION_1, subscriptionId);
        await complete(SESSION_2, second);
        const events = await tx.select().from(outboxEventsTable).where(eq(outboxEventsTable.subscriptionId, second));
        expect(events).toEqual([
          expect.objectContaining({ eventType: OUTBOUND_EVENT_TYPE.SUBSCRIPTION_CANCELED, sequence: 1 }),
        ]);
      });
    });

    it('activates checkouts of two different customers independently', async () => {
      await withRollback(testDb(), async (tx) => {
        const { ctx, provider, app, subscriptionId, complete } = await setup(tx);
        const other = await createCustomer(tx, ctx.tenantId, OTHER_EXTERNAL_REF);
        if (other.outcome !== CREATE_CUSTOMER_OUTCOME.CREATED) throw new Error('second customer already existed');
        const second = await startTestCheckout(app, { ...ctx, customerId: other.customer.customerId });
        provider.scriptCharge(SUCCEEDED);
        provider.scriptCharge({ outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: 'charge-2' });
        await complete(SESSION_1, subscriptionId);
        await complete(SESSION_2, second);
        expect(await subscriptionRow(tx, second)).toMatchObject({ status: SUBSCRIPTION_STATUS.ACTIVE });
      });
    });
  });

  describe('no effect', () => {
    it('does nothing when the provider says the checkout is not completed (Spec 4 rule 3)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        provider.scriptCheckoutNotCompleted();
        expect((await complete()).status).toBe(200);
        expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.INCOMPLETE });
        expect(provider.calls.charge).toEqual([]);
        expect(await tx.$count(paymentMethodsTable)).toBe(0);
      });
    });

    it('is a no-op for a canceled subscription (row 16, the canceled firewall)', async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        await tx
          .update(subscriptionsTable)
          .set({
            status: SUBSCRIPTION_STATUS.CANCELED,
            canceledAt: TEST_NOW,
            cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
          })
          .where(eq(subscriptionsTable.subscriptionId, subscriptionId));
        expect((await complete()).status).toBe(200);
        expect(provider.calls.verifyCheckout).toEqual([]);
        expect(provider.calls.charge).toEqual([]);
      });
    });

    it.each([
      ['a session other than the one this subscription started', (): WebhookOverride => ({ sessionRef: 'session-9' })],
      ['a reference that is not a subscription id', (): WebhookOverride => ({ reference: 'not-a-uuid' })],
      ['an unknown subscription id', (): WebhookOverride => ({ reference: '7d1c6a1e-2f3b-4c5d-8e9f-0a1b2c3d4e5f' })],
    ])('ignores %s without asking the provider', async (_, override) => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        const { sessionRef = SESSION_1, reference = subscriptionId } = override();
        expect((await complete(sessionRef, reference)).status).toBe(200);
        expect(provider.calls.verifyCheckout).toEqual([]);
        expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.INCOMPLETE });
      });
    });

    it("ignores a subscription posted to another organization's connection (ADR 0010 amendment 6)", async () => {
      await withRollback(testDb(), async (tx) => {
        const { provider, subscriptionId, complete } = await setup(tx);
        const globex = await seedBillingContext(tx, GLOBEX);
        expect((await complete(SESSION_1, subscriptionId, globex.providerConnectionId)).status).toBe(200);
        expect(provider.calls.verifyCheckout).toEqual([]);
        expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({ status: SUBSCRIPTION_STATUS.INCOMPLETE });
      });
    });
  });
});
