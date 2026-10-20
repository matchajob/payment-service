import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { CURRENCY } from '@/lib/money/currency';
import type { ChargeRequest } from '@/lib/payments/provider';
import { STRIPE_PATH } from '@tests/utils/stripe-paths';
import {
  cardDeclinedReply,
  HTTP_PAYMENT_REQUIRED,
  invalidRequestReply,
  paymentIntentReply,
  STRIPE_DECLINE_CODE,
  STRIPE_DEDUP_KEY as DEDUP_KEY,
  STRIPE_PAYMENT_INTENT_ID,
} from '@tests/utils/stripe-payment-intent-replies';
import { savedStripeCard, stripeUnderTest } from '@tests/utils/stripe-provider-under-test';
import { STRIPE_CUSTOMER_ID, STRIPE_PAYMENT_METHOD_ID } from '@tests/utils/stripe-session-replies';

const CHARGE_SERIAL = 41n;
const PLAN_MINOR = 4900;
const AUTHENTICATION_REQUIRED = 'authentication_required';
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

const chargeOf = (paymentMethodToken: string, overrides: Partial<ChargeRequest> = {}): ChargeRequest => ({
  paymentMethodToken,
  amountMinor: PLAN_MINOR,
  currency: CURRENCY.ILS,
  dedupKey: DEDUP_KEY,
  chargeSerial: CHARGE_SERIAL,
  ...overrides,
});

const ready = async () => {
  const under = stripeUnderTest();
  return { ...under, token: await savedStripeCard(under) };
};

describe('stripeProvider.charge: the request (ADR 0020 decision 6)', () => {
  it('confirms an off-session PaymentIntent on the saved customer and card, keyed by the dedup key', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(paymentIntentReply('succeeded', PLAN_MINOR, 'ils'));
    await stripe.charge(chargeOf(token));
    expect(wire.requests).toEqual([
      expect.objectContaining({
        path: STRIPE_PATH.PAYMENT_INTENTS,
        verb: 'POST',
        idempotencyKey: DEDUP_KEY,
        fields: {
          amount: String(PLAN_MINOR),
          currency: 'ils',
          customer: STRIPE_CUSTOMER_ID,
          payment_method: STRIPE_PAYMENT_METHOD_ID,
          off_session: 'true',
          confirm: 'true',
          'metadata[dedup_key]': DEDUP_KEY,
          'metadata[charge_serial]': String(CHARGE_SERIAL),
        },
      }),
    ]);
  });

  it('sends the amount in minor units and the currency in lowercase', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(paymentIntentReply('succeeded', 1999, 'usd'));
    await stripe.charge(chargeOf(token, { amountMinor: 1999, currency: CURRENCY.USD }));
    expect(wire.requests[0]?.fields).toEqual(expect.objectContaining({ amount: '1999', currency: 'usd' }));
  });
});

describe('stripeProvider.charge: outcomes', () => {
  it('succeeds with the PaymentIntent id when Stripe reports it succeeded', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(paymentIntentReply('succeeded', PLAN_MINOR, 'ils'));
    expect(await stripe.charge(chargeOf(token))).toEqual({
      outcome: CHARGE_STATUS.SUCCEEDED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
    });
  });

  it("fails with the decline code and the declined PaymentIntent's id on a 402 card error", async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(cardDeclinedReply(), HTTP_PAYMENT_REQUIRED);
    expect(await stripe.charge(chargeOf(token))).toEqual({
      outcome: CHARGE_STATUS.FAILED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
      reason: STRIPE_DECLINE_CODE,
    });
  });

  it('fails with the error code when the card error has no decline code (SCA on an off-session charge)', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(cardDeclinedReply(AUTHENTICATION_REQUIRED, null), HTTP_PAYMENT_REQUIRED);
    expect(await stripe.charge(chargeOf(token))).toEqual(
      expect.objectContaining({ outcome: CHARGE_STATUS.FAILED, reason: AUTHENTICATION_REQUIRED }),
    );
  });
});

describe('stripeProvider.charge: off-session, nobody can complete SCA', () => {
  it('fails a 2xx PaymentIntent that requires action, with the status as the reason', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(paymentIntentReply('requires_action', PLAN_MINOR, 'ils'));
    expect(await stripe.charge(chargeOf(token))).toEqual({
      outcome: CHARGE_STATUS.FAILED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
      reason: 'requires_action',
    });
  });
});

describe('stripeProvider.charge: an answer it cannot vouch for throws, so the charge stays pending for reconcile (ADR 0017)', () => {
  it('throws on a 2xx PaymentIntent that is still processing', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply(paymentIntentReply('processing', PLAN_MINOR, 'ils'));
    await expect(stripe.charge(chargeOf(token))).rejects.toThrow();
  });

  it.each([HTTP_BAD_REQUEST, HTTP_TOO_MANY_REQUESTS])('throws on a %s that is not a card error', async (status) => {
    const { stripe, wire, token } = await ready();
    wire.reply(invalidRequestReply('Keys for idempotent requests can only be used with the same parameters'), status);
    await expect(stripe.charge(chargeOf(token))).rejects.toThrow();
  });

  it('throws on a 5xx', async () => {
    const { stripe, wire, token } = await ready();
    wire.reply({ error: { type: 'api_error', message: 'boom' } }, HTTP_SERVICE_UNAVAILABLE);
    await expect(stripe.charge(chargeOf(token))).rejects.toThrow();
  });

  it('throws when the network call fails', async () => {
    const { stripe, wire, token } = await ready();
    wire.rejectWith(new TypeError('fetch failed'));
    await expect(stripe.charge(chargeOf(token))).rejects.toThrow();
  });
});

describe('stripeProvider.charge: what it refuses before calling Stripe', () => {
  it('refuses a payment method token it did not issue', async () => {
    const { stripe, wire } = stripeUnderTest();
    await expect(stripe.charge(chargeOf(STRIPE_PAYMENT_METHOD_ID))).rejects.toThrow();
    expect(wire.requests).toEqual([]);
  });
});
