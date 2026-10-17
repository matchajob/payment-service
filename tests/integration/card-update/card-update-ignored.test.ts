import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { paymentMethodsOf, paymentMethodUpdatesOf } from '@tests/utils/payment-method-reads';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { HOUR_MS } from '@tests/utils/reconcile-times';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const UPDATED_AT = new Date('2026-02-01T10:00:00.000Z');
const NEVER_REQUESTED = 'session-99';
const tokenOf = (sessionRef: string) => `token-${sessionRef}`;

describe('card update completion: what it ignores (ADR 0018)', () => {
  it('replaces the card once when the provider redelivers the webhook with a different body', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();
      await flow.complete(sessionRef);
      const reformatted = `${fakeCheckoutCompletedBody(active.subscription.subscriptionId, sessionRef)} `;

      const redelivery = await flow.app.request(
        webhookPath(active.subscription.providerConnectionId),
        postWebhook(reformatted),
      );

      expect(redelivery.status).toBe(200);
      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toHaveLength(2);
      expect(flow.provider.calls.verifyCheckout).toHaveLength(1);
    });
  });

  it('ignores a session the subscription never requested, without asking the provider', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      await flow.start();

      expect((await flow.complete(NEVER_REQUESTED)).status).toBe(200);

      expect(flow.provider.calls.verifyCheckout).toEqual([]);
      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toHaveLength(1);
    });
  });

  it('ignores a completion that names another subscription than the one that asked', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const other = await seedRenewing(tx, {}, GLOBEX);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();

      await flow.complete(sessionRef, other.subscription.subscriptionId);

      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toHaveLength(1);
      expect(await paymentMethodsOf(tx, other.subscription.subscriptionId)).toHaveLength(1);
    });
  });

  it('keeps the card and the request open when the provider says the checkout was not completed', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCheckoutNotCompleted();

      await flow.complete(sessionRef);

      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toHaveLength(1);
      expect(await paymentMethodUpdatesOf(tx, active.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ completedAt: null }),
      ]);
    });
  });

  it('still honours an older link completed after a newer one was requested (ADR 0018 decision 1)', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const older = await flow.start();
      flow.clock.advance(HOUR_MS);
      const newer = await flow.start();

      await flow.complete(older);
      const afterOlder = await paymentMethodsOf(tx, active.subscription.subscriptionId);
      await flow.complete(newer);
      const afterNewer = await paymentMethodsOf(tx, active.subscription.subscriptionId);

      expect(afterOlder.at(-1)).toMatchObject({ providerToken: tokenOf(older), replacedAt: null });
      expect(afterNewer.at(-1)).toMatchObject({ providerToken: tokenOf(newer), replacedAt: null });
      expect(afterNewer).toHaveLength(3);
    });
  });

  it('leaves the card of a subscription canceled before the customer finished', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();
      await tx
        .update(subscriptionsTable)
        .set({
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceledAt: UPDATED_AT,
          cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
        })
        .where(eq(subscriptionsTable.subscriptionId, active.subscription.subscriptionId));

      expect((await flow.complete(sessionRef)).status).toBe(200);

      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ paymentMethodId: active.paymentMethodId, replacedAt: null }),
      ]);
    });
  });
});
