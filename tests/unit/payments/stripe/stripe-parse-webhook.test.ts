import { describe, expect, it } from 'vitest';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import { checkoutCompletedBody, stripeEventBody } from '@tests/utils/stripe-event-bodies';
import { STRIPE_TEST_REFERENCE, startedStripeSession, stripeUnderTest } from '@tests/utils/stripe-provider-under-test';
import { STRIPE_SESSION_ID } from '@tests/utils/stripe-session-replies';

const UNRECOGNIZED = { kind: WEBHOOK_KIND.UNRECOGNIZED };

describe('stripeProvider.parseWebhook: an event only triggers verification (webhook-trust rule 3, ADR 0020 decision 5)', () => {
  it('reads checkout.session.completed as a checkout completion carrying our reference and the session id', () => {
    const { stripe } = stripeUnderTest();
    expect(stripe.parseWebhook(checkoutCompletedBody(STRIPE_TEST_REFERENCE))).toEqual({
      kind: WEBHOOK_KIND.CHECKOUT_COMPLETED,
      reference: STRIPE_TEST_REFERENCE,
      sessionRef: STRIPE_SESSION_ID,
    });
  });

  it('names the same session ref that startCheckout returned, so completeCheckout finds it', async () => {
    const under = stripeUnderTest();
    const { providerSessionRef } = await startedStripeSession(under);
    expect(under.stripe.parseWebhook(checkoutCompletedBody(STRIPE_TEST_REFERENCE))).toEqual(
      expect.objectContaining({ sessionRef: providerSessionRef }),
    );
  });

  it('ignores a completed session without our reference', () => {
    const { stripe } = stripeUnderTest();
    expect(stripe.parseWebhook(checkoutCompletedBody(null))).toEqual(UNRECOGNIZED);
  });

  it('ignores any other event type', () => {
    const { stripe } = stripeUnderTest();
    const other = stripeEventBody('payment_intent.succeeded', { id: 'pi_1', object: 'payment_intent' });
    expect(stripe.parseWebhook(other)).toEqual(UNRECOGNIZED);
  });

  it.each(['', 'not json', JSON.stringify({ type: 'checkout.session.completed' })])(
    'ignores a body that is not a Stripe event: %s',
    (body) => {
      const { stripe } = stripeUnderTest();
      expect(stripe.parseWebhook(body)).toEqual(UNRECOGNIZED);
    },
  );
});
