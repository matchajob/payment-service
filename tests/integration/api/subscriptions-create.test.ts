import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { idempotencyKeysTable } from '@/lib/idempotency/schema';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { seedBillingContext, type BillingContext } from '@tests/utils/billing-context';
import { testDb, withRollback } from '@tests/utils/db';
import { FAKE_CHECKOUT_URL, fakePaymentProvider } from '@tests/utils/fake-payment-provider';
import { SUBSCRIPTIONS_PATH } from '@tests/utils/paths';
import { postJson } from '@tests/utils/post-json';
import { testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const RETURN_URL = 'https://tenant.test/billing/return';
const MALFORMED_JSON = '{"customerId":';

const validBody = ({ customerId, plan }: BillingContext) => ({
  customerId,
  planId: plan.planId,
  returnUrl: RETURN_URL,
});

describe('POST /v1/subscriptions', () => {
  it('answers 201 with an incomplete subscription and the checkout URL', async () => {
    await withRollback(testDb(), async (tx) => {
      const ctx = await seedBillingContext(tx);
      const res = await testApp(tx).request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx)));
      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data).toEqual({
        subscriptionId: expect.any(String),
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
        checkoutUrl: FAKE_CHECKOUT_URL,
      });
    });
  });

  it('stores the row as incomplete, self-scheduled, with the session ref and no period', async () => {
    await withRollback(testDb(), async (tx) => {
      const ctx = await seedBillingContext(tx);
      const { data } = await (
        await testApp(tx).request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx)))
      ).json();
      const [row] = await tx
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.subscriptionId, data.subscriptionId));
      expect(row).toMatchObject({
        tenantId: ctx.tenantId,
        customerId: ctx.customerId,
        planId: ctx.plan.planId,
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
        scheduleOwner: SCHEDULE_OWNER.SELF,
        checkoutSessionRef: 'session-1',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    });
  });

  it("asks the provider to save the card for the plan's price, referenced by our subscription id (ADR 0007)", async () => {
    await withRollback(testDb(), async (tx) => {
      const ctx = await seedBillingContext(tx);
      const provider = fakePaymentProvider();
      const { data } = await (
        await testApp(tx, { provider }).request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx)))
      ).json();
      expect(provider.calls.startCheckout).toEqual([
        {
          mode: CHECKOUT_MODE.CAPTURE,
          reference: data.subscriptionId,
          amountMinor: ctx.plan.amountMinor,
          currency: ctx.plan.currency,
          returnUrl: RETURN_URL,
        },
      ]);
    });
  });

  it('ignores a price sent in the body', async () => {
    await withRollback(testDb(), async (tx) => {
      const ctx = await seedBillingContext(tx);
      const provider = fakePaymentProvider();
      await testApp(tx, { provider }).request(
        SUBSCRIPTIONS_PATH,
        postJson(ctx.apiKey, { ...validBody(ctx), amountMinor: 1 }),
      );
      expect(provider.calls.startCheckout[0]?.amountMinor).toBe(ctx.plan.amountMinor);
    });
  });

  it('allows a second checkout for the same customer while the first is incomplete', async () => {
    await withRollback(testDb(), async (tx) => {
      const ctx = await seedBillingContext(tx);
      const app = testApp(tx);
      await app.request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx)));
      const second = await app.request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx)));
      expect(second.status).toBe(201);
      expect(await tx.$count(subscriptionsTable)).toBe(2);
    });
  });

  describe('not found', () => {
    it.each([
      ['an unknown customer', (ctx: BillingContext) => ({ ...validBody(ctx), customerId: randomUUID() })],
      ['an unknown plan', (ctx: BillingContext) => ({ ...validBody(ctx), planId: randomUUID() })],
    ])('answers 404 for %s without calling the provider', async (_, body) => {
      await withRollback(testDb(), async (tx) => {
        const ctx = await seedBillingContext(tx);
        const provider = fakePaymentProvider();
        const res = await testApp(tx, { provider }).request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, body(ctx)));
        expect(res.status).toBe(404);
        expect(problemSchema.parse(await res.json()).status).toBe(404);
        expect(provider.calls.startCheckout).toEqual([]);
        expect(await tx.$count(subscriptionsTable)).toBe(0);
      });
    });

    it.each([
      [
        "another tenant's customer",
        (own: BillingContext, foreign: BillingContext) => ({ ...validBody(own), customerId: foreign.customerId }),
      ],
      [
        "another tenant's plan",
        (own: BillingContext, foreign: BillingContext) => ({ ...validBody(own), planId: foreign.plan.planId }),
      ],
    ])('answers 404 for %s, never 403', async (_, body) => {
      await withRollback(testDb(), async (tx) => {
        const own = await seedBillingContext(tx);
        const foreign = await seedBillingContext(tx, GLOBEX);
        const res = await testApp(tx).request(SUBSCRIPTIONS_PATH, postJson(own.apiKey, body(own, foreign)));
        expect(res.status).toBe(404);
        expect(await tx.$count(subscriptionsTable)).toBe(0);
      });
    });
  });

  describe('bad request', () => {
    it.each([
      ['a javascript: return URL', (ctx: BillingContext) => ({ ...validBody(ctx), returnUrl: 'javascript:alert(1)' })],
      ['a relative return URL', (ctx: BillingContext) => ({ ...validBody(ctx), returnUrl: '/billing/return' })],
      ['a malformed customer id', (ctx: BillingContext) => ({ ...validBody(ctx), customerId: 'not-a-uuid' })],
      ['a missing plan id', ({ customerId }: BillingContext) => ({ customerId, returnUrl: RETURN_URL })],
    ])('answers 400 for %s without calling the provider', async (_, body) => {
      await withRollback(testDb(), async (tx) => {
        const ctx = await seedBillingContext(tx);
        const provider = fakePaymentProvider();
        const res = await testApp(tx, { provider }).request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, body(ctx)));
        expect(res.status).toBe(400);
        expect(provider.calls.startCheckout).toEqual([]);
      });
    });

    it('answers 400 for malformed JSON instead of 500', async () => {
      await withRollback(testDb(), async (tx) => {
        const ctx = await seedBillingContext(tx);
        const res = await testApp(tx).request(SUBSCRIPTIONS_PATH, {
          ...postJson(ctx.apiKey, {}),
          body: MALFORMED_JSON,
        });
        expect(res.status).toBe(400);
      });
    });
  });

  describe('provider failure (ADR 0006)', () => {
    it('answers 500 and leaves no subscription and no reserved key', async () => {
      await withRollback(testDb(), async (tx) => {
        const ctx = await seedBillingContext(tx);
        const provider = fakePaymentProvider();
        provider.failCheckouts();
        const res = await testApp(tx, { provider }).request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx)));
        expect(res.status).toBe(500);
        expect(await tx.$count(subscriptionsTable)).toBe(0);
        expect(await tx.$count(idempotencyKeysTable)).toBe(0);
      });
    });
  });

  describe('idempotent replay', () => {
    it('replays the same body without a second checkout or a second row', async () => {
      await withRollback(testDb(), async (tx) => {
        const ctx = await seedBillingContext(tx);
        const provider = fakePaymentProvider();
        const app = testApp(tx, { provider });
        const key = randomUUID();
        const first = await app.request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx), key));
        const replay = await app.request(SUBSCRIPTIONS_PATH, postJson(ctx.apiKey, validBody(ctx), key));
        expect(replay.status).toBe(201);
        expect(await replay.json()).toEqual(await first.json());
        expect(provider.calls.startCheckout).toHaveLength(1);
        expect(await tx.$count(subscriptionsTable)).toBe(1);
      });
    });
  });
});
