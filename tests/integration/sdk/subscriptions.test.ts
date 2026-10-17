import { describe, expect, it } from 'vitest';
import { REJECTION_REASON } from '@/lib/subscriptions/state-machine/rejection-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { PaymentServiceError } from '@sdk/payment-service-error';
import { seedBillingContext } from '@tests/utils/billing-context';
import { CARD_UPDATE_RETURN_URL, cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { FAKE_CHECKOUT_URL } from '@tests/utils/fake-payment-provider';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { sdkFor } from '@tests/utils/sdk-client';
import { testApp } from '@tests/utils/test-app';

const RETURN_URL = 'https://tenant.test/billing/return';
const UPDATED_AT = new Date('2026-02-01T10:00:00.000Z');

describe('SDK subscriptions, run against the real app (ADR 0015)', () => {
  it('creates an incomplete subscription and returns the checkout URL', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey, customerId, plan } = await seedBillingContext(tx);
      const created = await sdkFor(testApp(tx), apiKey).subscriptions.create({
        customerId,
        planId: plan.planId,
        returnUrl: RETURN_URL,
      });
      expect(created).toEqual({
        subscriptionId: expect.any(String),
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
        checkoutUrl: FAKE_CHECKOUT_URL,
      });
    });
  });

  it('reads a subscription as a snapshot', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx);
      const snapshot = await sdkFor(testApp(tx), ctx.apiKey).subscriptions.get(subscription.subscriptionId);
      expect(snapshot).toMatchObject({
        subscriptionId: subscription.subscriptionId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        entitled: true,
        currentPeriodEnd: PERIOD_END.toISOString(),
        cancelAtPeriodEnd: false,
      });
    });
  });

  it('cancels at period end, then resumes', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx);
      const sdk = sdkFor(testApp(tx), ctx.apiKey);
      const canceled = await sdk.subscriptions.cancel(subscription.subscriptionId);
      expect(canceled).toMatchObject({ status: SUBSCRIPTION_STATUS.ACTIVE, cancelAtPeriodEnd: true });
      const resumed = await sdk.subscriptions.resume(subscription.subscriptionId);
      expect(resumed).toMatchObject({ status: SUBSCRIPTION_STATUS.ACTIVE, cancelAtPeriodEnd: false });
    });
  });

  it('starts a card update and returns the checkout URL', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const { app } = cardUpdateFlow(tx, active, UPDATED_AT);
      const update = await sdkFor(app, active.ctx.apiKey).subscriptions.updatePaymentMethod(
        active.subscription.subscriptionId,
        { returnUrl: CARD_UPDATE_RETURN_URL },
      );
      expect(update).toEqual({ subscriptionId: active.subscription.subscriptionId, checkoutUrl: FAKE_CHECKOUT_URL });
    });
  });

  it('throws a typed 409 error whose detail is the rejection reason', async () => {
    await withRollback(testDb(), async (tx) => {
      const canceled = await seedRenewing(tx, { status: SUBSCRIPTION_STATUS.CANCELED });
      const { app } = cardUpdateFlow(tx, canceled, UPDATED_AT);
      const failure = await sdkFor(app, canceled.ctx.apiKey)
        .subscriptions.updatePaymentMethod(canceled.subscription.subscriptionId, { returnUrl: CARD_UPDATE_RETURN_URL })
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(PaymentServiceError);
      expect(failure).toMatchObject({ status: 409, problem: { detail: REJECTION_REASON.NOT_ACCEPTED_IN_STATE } });
    });
  });
});
