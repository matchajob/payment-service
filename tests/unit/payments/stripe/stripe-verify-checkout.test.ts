import { describe, expect, it } from 'vitest';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import { STRIPE_PATH } from '@tests/utils/stripe-paths';
import { invalidRequestReply } from '@tests/utils/stripe-payment-intent-replies';
import { savedStripeCard, startedStripeSession, stripeUnderTest } from '@tests/utils/stripe-provider-under-test';
import {
  completedSetupSessionReply,
  retrievedSessionReply,
  STRIPE_PAYMENT_METHOD_ID,
  STRIPE_SESSION_ID,
} from '@tests/utils/stripe-session-replies';

const HTTP_NOT_FOUND = 404;
const OTHER_PAYMENT_METHOD = 'pm_1OtherPaymentMethod';

describe('stripeProvider.verifyCheckout: re-fetches the session from Stripe (ADR 0020 decisions 4, 5)', () => {
  it('reads the session by id with both intents expanded', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(completedSetupSessionReply());
    await stripe.verifyCheckout(STRIPE_SESSION_ID);
    expect(wire.requests).toEqual([
      expect.objectContaining({ path: `${STRIPE_PATH.CHECKOUT_SESSIONS}/${STRIPE_SESSION_ID}`, verb: 'GET' }),
    ]);
    expect(wire.requests[0]?.query.getAll('expand[]')).toEqual(['payment_intent', 'setup_intent']);
  });

  it('saves the card from a complete setup session as an opaque token, not a bare Stripe id', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(completedSetupSessionReply());
    const verified = await stripe.verifyCheckout(STRIPE_SESSION_ID);
    expect(verified).toEqual({ outcome: CHECKOUT_VERIFICATION.CARD_SAVED, paymentMethodToken: expect.any(String) });
    expect(verified).not.toEqual(expect.objectContaining({ paymentMethodToken: STRIPE_PAYMENT_METHOD_ID }));
  });

  it('saves the card a complete payment session kept for off-session use', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(retrievedSessionReply({ status: 'complete', paymentPaymentMethod: STRIPE_PAYMENT_METHOD_ID }));
    expect(await stripe.verifyCheckout(STRIPE_SESSION_ID)).toEqual(
      expect.objectContaining({ outcome: CHECKOUT_VERIFICATION.CARD_SAVED }),
    );
  });

  it('gives different cards different tokens', async () => {
    const under = stripeUnderTest();
    const first = await savedStripeCard(under);
    const second = await savedStripeCard(under, OTHER_PAYMENT_METHOD);
    expect(second).not.toBe(first);
  });

  it.each(['open', 'expired'])('reports a %s session as not completed', async (status) => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(retrievedSessionReply({ status }));
    expect(await stripe.verifyCheckout(STRIPE_SESSION_ID)).toEqual({ outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED });
  });

  it('throws on a complete session without a customer, which no off-session charge could use', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(
      retrievedSessionReply({ status: 'complete', customer: null, setupPaymentMethod: STRIPE_PAYMENT_METHOD_ID }),
    );
    await expect(stripe.verifyCheckout(STRIPE_SESSION_ID)).rejects.toThrow();
  });

  it('throws on a complete session without a payment method', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(retrievedSessionReply({ status: 'complete' }));
    await expect(stripe.verifyCheckout(STRIPE_SESSION_ID)).rejects.toThrow();
  });

  it('throws when Stripe refuses the lookup, which must never read as "not completed"', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(invalidRequestReply('No such checkout.session'), HTTP_NOT_FOUND);
    await expect(stripe.verifyCheckout(STRIPE_SESSION_ID)).rejects.toThrow();
  });

  it('round-trips with startCheckout: the session ref it returned is the one it verifies', async () => {
    const under = stripeUnderTest();
    const { providerSessionRef } = await startedStripeSession(under);
    under.wire.reply(completedSetupSessionReply());
    await under.stripe.verifyCheckout(providerSessionRef);
    expect(under.wire.requests.at(-1)?.path).toBe(`${STRIPE_PATH.CHECKOUT_SESSIONS}/${STRIPE_SESSION_ID}`);
  });
});
