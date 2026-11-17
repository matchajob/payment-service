import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { CHECKOUT_COMPLETION_IGNORED } from '@/lib/webhooks/checkout-completion-ignored';
import { IGNORED_REASON } from '@/lib/webhooks/ignored-reason';
import { WEBHOOK_IGNORED } from '@/lib/webhooks/webhook-ignored';
import { seedBillingContext } from '@tests/utils/billing-context';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { startTestCheckout } from '@tests/utils/checkout-flow';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { ignoredLines } from '@tests/utils/ignored-log-lines';
import { PINO_LEVEL } from '@tests/utils/pino-levels';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { TEST_NOW, testApp } from '@tests/utils/test-app';

const GARBAGE = 'definitely not a provider payload';
const STARTED_SESSION = 'session-1';
const OTHER_SESSION = 'session-9';
const NOT_A_UUID = 'not-a-uuid';
const UNKNOWN_SUBSCRIPTION_ID = '7d1c6a1e-2f3b-4c5d-8e9f-0a1b2c3d4e5f';

const checkout = async (tx: Database) => {
  const log = capturingLogger();
  const ctx = await seedBillingContext(tx);
  const providers = fakeProviderFactory();
  const app = testApp(tx, { providerFor: providers.providerFor, logger: log.logger });
  const subscriptionId = await startTestCheckout(app, ctx);
  const complete = (sessionRef: string, reference: string = subscriptionId) =>
    app.request(webhookPath(ctx.providerConnectionId), postWebhook(fakeCheckoutCompletedBody(reference, sessionRef)));
  return { log, ctx, subscriptionId, complete };
};

describe('ignored webhooks are logged (Spec 4 rule 6, Spec 1 row 16, code-review-1 M23)', () => {
  it('logs an unrecognized payload with the stored event and its connection', async () => {
    await withRollback(testDb(), async (tx) => {
      const log = capturingLogger();
      const { providerConnectionId } = await seedConnection(tx);
      await testApp(tx, { logger: log.logger }).request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      expect(ignoredLines(log)).toEqual([
        expect.objectContaining({
          level: PINO_LEVEL.WARN,
          msg: WEBHOOK_IGNORED,
          reason: IGNORED_REASON.UNRECOGNIZED_PAYLOAD,
          providerConnectionId,
          webhookEventId: expect.any(String),
        }),
      ]);
    });
  });

  it('logs a completion for a subscription that no longer awaits checkout (the canceled firewall)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { log, subscriptionId, complete } = await checkout(tx);
      await tx
        .update(subscriptionsTable)
        .set({
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceledAt: TEST_NOW,
          cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
        })
        .where(eq(subscriptionsTable.subscriptionId, subscriptionId));
      await complete(STARTED_SESSION);
      expect(ignoredLines(log)).toEqual([
        expect.objectContaining({
          level: PINO_LEVEL.WARN,
          msg: CHECKOUT_COMPLETION_IGNORED,
          reason: IGNORED_REASON.NOT_AWAITING_CHECKOUT,
          subscriptionId,
        }),
      ]);
    });
  });

  it('logs a completion for a session other than the one the subscription started', async () => {
    await withRollback(testDb(), async (tx) => {
      const { log, subscriptionId, complete } = await checkout(tx);
      await complete(OTHER_SESSION);
      expect(ignoredLines(log)).toEqual([
        expect.objectContaining({ reason: IGNORED_REASON.SESSION_MISMATCH, subscriptionId, sessionRef: OTHER_SESSION }),
      ]);
    });
  });

  it.each([
    ['a reference that is not a subscription id', NOT_A_UUID],
    ['an unknown subscription id', UNKNOWN_SUBSCRIPTION_ID],
  ])('logs %s with the reference it was given', async (_, reference) => {
    await withRollback(testDb(), async (tx) => {
      const { log, ctx, complete } = await checkout(tx);
      await complete(STARTED_SESSION, reference);
      expect(ignoredLines(log)).toEqual([
        expect.objectContaining({
          reason: IGNORED_REASON.UNKNOWN_SUBSCRIPTION,
          reference,
          providerConnectionId: ctx.providerConnectionId,
        }),
      ]);
    });
  });
});
