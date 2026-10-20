import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import type { CheckoutRequest } from '@/lib/payments/provider';
import { STRIPE_SECRET_KEY } from '@tests/utils/stripe-credentials-fixtures';
import { STRIPE_PATH } from '@tests/utils/stripe-paths';
import { invalidRequestReply } from '@tests/utils/stripe-payment-intent-replies';
import {
  STRIPE_TEST_PLAN_MINOR,
  STRIPE_TEST_REFERENCE,
  STRIPE_TEST_RETURN_URL,
  stripeUnderTest,
} from '@tests/utils/stripe-provider-under-test';
import {
  createdSessionReply,
  customerReply,
  STRIPE_CHECKOUT_URL,
  STRIPE_CUSTOMER_ID,
  STRIPE_SESSION_ID,
} from '@tests/utils/stripe-session-replies';

const HTTP_BAD_REQUEST = 400;

const capture: CheckoutRequest = {
  mode: CHECKOUT_MODE.CAPTURE,
  reference: STRIPE_TEST_REFERENCE,
  amountMinor: STRIPE_TEST_PLAN_MINOR,
  currency: CURRENCY.ILS,
  returnUrl: STRIPE_TEST_RETURN_URL,
};
const charge: CheckoutRequest = { ...capture, mode: CHECKOUT_MODE.CHARGE, currency: CURRENCY.USD };

describe('stripeProvider.startCheckout: a card-only save (ADR 0007, ADR 0020 decision 3)', () => {
  it('creates a customer first, so the saved card can be charged again off-session', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(customerReply());
    wire.reply(createdSessionReply());
    await stripe.startCheckout(capture);
    expect(wire.requests[0]).toEqual(
      expect.objectContaining({
        path: STRIPE_PATH.CUSTOMERS,
        verb: 'POST',
        authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        fields: expect.objectContaining({ 'metadata[reference]': STRIPE_TEST_REFERENCE }),
      }),
    );
  });

  it('opens a setup-mode session for that customer, carrying our reference and the return URL', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(customerReply());
    wire.reply(createdSessionReply());
    await stripe.startCheckout(capture);
    expect(wire.requests[1]).toEqual(
      expect.objectContaining({
        path: STRIPE_PATH.CHECKOUT_SESSIONS,
        verb: 'POST',
        idempotencyKey: null,
        fields: {
          mode: 'setup',
          customer: STRIPE_CUSTOMER_ID,
          currency: 'ils',
          client_reference_id: STRIPE_TEST_REFERENCE,
          success_url: STRIPE_TEST_RETURN_URL,
          cancel_url: STRIPE_TEST_RETURN_URL,
        },
      }),
    );
  });

  it("returns Stripe's hosted URL and the session id as the session ref", async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(customerReply());
    wire.reply(createdSessionReply());
    expect(await stripe.startCheckout(capture)).toEqual({
      checkoutUrl: STRIPE_CHECKOUT_URL,
      providerSessionRef: STRIPE_SESSION_ID,
    });
  });

  it('throws when Stripe refuses the session, so no subscription points at a dead session', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(customerReply());
    wire.reply(invalidRequestReply('Invalid currency'), HTTP_BAD_REQUEST);
    await expect(stripe.startCheckout(capture)).rejects.toThrow();
  });

  it('throws when Stripe refuses the customer, before opening any session', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(invalidRequestReply('Invalid API key'), HTTP_BAD_REQUEST);
    await expect(stripe.startCheckout(capture)).rejects.toThrow();
    expect(wire.requests).toHaveLength(1);
  });
});

describe('stripeProvider.startCheckout: a charging checkout (ADR 0020 decision 3)', () => {
  it('opens a payment-mode session that creates a customer and keeps the card for off-session use', async () => {
    const { stripe, wire } = stripeUnderTest();
    wire.reply(createdSessionReply());
    await stripe.startCheckout(charge);
    expect(wire.requests).toEqual([
      expect.objectContaining({
        path: STRIPE_PATH.CHECKOUT_SESSIONS,
        fields: {
          mode: 'payment',
          customer_creation: 'always',
          'payment_intent_data[setup_future_usage]': 'off_session',
          'line_items[0][quantity]': '1',
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][unit_amount]': String(STRIPE_TEST_PLAN_MINOR),
          'line_items[0][price_data][product_data][name]': expect.any(String),
          client_reference_id: STRIPE_TEST_REFERENCE,
          success_url: STRIPE_TEST_RETURN_URL,
          cancel_url: STRIPE_TEST_RETURN_URL,
        },
      }),
    ]);
  });
});
