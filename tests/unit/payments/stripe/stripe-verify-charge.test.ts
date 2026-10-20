import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import type { VerifyChargeRequest } from '@/lib/payments/provider';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { STRIPE_PATH } from '@tests/utils/stripe-paths';
import {
  invalidRequestReply,
  paymentIntentReply,
  searchReply,
  cardDeclinedReply,
  STRIPE_CARD_PAYMENT_METHOD_ID,
  STRIPE_DECLINE_CODE,
  STRIPE_DEDUP_KEY as DEDUP_KEY,
  STRIPE_PAYMENT_INTENT_ID,
} from '@tests/utils/stripe-payment-intent-replies';
import { savedStripeCard, stripeUnderTest } from '@tests/utils/stripe-provider-under-test';

const CHARGE_SERIAL = 41n;
const PLAN_MINOR = 4900;
const QUOTED_DEDUP_KEY = "sub-o'brien\\:0";
const OTHER_DEDUP_KEY = 'another-subscription:2026-02-15T10:00:00.000Z:0';
const HTTP_NOT_FOUND = 404;
const CARD_DECLINED = 'card_declined';

const ready = async () => {
  const under = stripeUnderTest();
  const token = await savedStripeCard(under);
  const request = (providerChargeRef: string | null, dedupKey: string = DEDUP_KEY): VerifyChargeRequest => ({
    dedupKey,
    providerChargeRef,
    paymentMethodToken: token,
    chargeSerial: CHARGE_SERIAL,
  });
  return { ...under, request };
};

describe('stripeProvider.verifyCharge: the lookup (ADR 0020 decision 7)', () => {
  it('reads the PaymentIntent by id when the charge ref is known', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(paymentIntentReply('succeeded', PLAN_MINOR, 'ils'));
    await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID));
    expect(wire.requests).toEqual([
      expect.objectContaining({ path: `${STRIPE_PATH.PAYMENT_INTENTS}/${STRIPE_PAYMENT_INTENT_ID}`, verb: 'GET' }),
    ]);
  });

  it('searches by the dedup key in metadata when no charge ref was stored', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(searchReply());
    await stripe.verifyCharge(request(null));
    expect(wire.requests).toEqual([expect.objectContaining({ path: STRIPE_PATH.PAYMENT_INTENTS_SEARCH, verb: 'GET' })]);
    expect(wire.requests[0]?.query.get('query')).toBe(`metadata['dedup_key']:'${DEDUP_KEY}'`);
  });

  it('escapes a quote and a backslash in the dedup key, so the key cannot end the search string', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(searchReply());
    await stripe.verifyCharge(request(null, QUOTED_DEDUP_KEY));
    expect(wire.requests[0]?.query.get('query')).toBe("metadata['dedup_key']:'sub-o\\'brien\\\\:0'");
  });
});

describe('stripeProvider.verifyCharge: outcomes', () => {
  it('reports a succeeded PaymentIntent with the amount and currency Stripe charged', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(paymentIntentReply('succeeded', PLAN_MINOR, 'ils'));
    expect(await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).toEqual({
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
      amountMinor: PLAN_MINOR,
      currency: CURRENCY.ILS,
    });
  });

  it('reports the PaymentIntent the search found, with its id as the charge ref', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(searchReply(paymentIntentReply('succeeded', PLAN_MINOR, 'usd')));
    expect(await stripe.verifyCharge(request(null))).toEqual({
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
      amountMinor: PLAN_MINOR,
      currency: CURRENCY.USD,
    });
  });

  it('reports processing as pending', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(paymentIntentReply('processing', PLAN_MINOR, 'ils'));
    expect(await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).toEqual({ outcome: VERIFY_OUTCOME.PENDING });
  });

  it.each(['requires_action', 'requires_confirmation'])(
    'reports %s as failed, because nobody is present to complete it off-session',
    async (status) => {
      const { stripe, wire, request } = await ready();
      wire.reply(paymentIntentReply(status, PLAN_MINOR, 'ils'));
      expect(await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).toEqual({
        outcome: VERIFY_OUTCOME.FAILED,
        providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
        reason: status,
      });
    },
  );

  it('throws when the PaymentIntent belongs to another dedup key, so a wrong ref never reads as succeeded', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(paymentIntentReply('succeeded', PLAN_MINOR, 'ils', null, OTHER_DEDUP_KEY));
    await expect(stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).rejects.toThrow();
  });

  it("keeps the refused reply's payment method out of the thrown error", async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(cardDeclinedReply(), HTTP_NOT_FOUND);
    const error = await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID)).catch((thrown: unknown) => thrown);
    expect(String(error)).toContain(STRIPE_DECLINE_CODE);
    expect(String(error)).not.toContain(STRIPE_CARD_PAYMENT_METHOD_ID);
  });

  it('reports requires_payment_method as failed with the decline code', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(
      paymentIntentReply('requires_payment_method', PLAN_MINOR, 'ils', {
        code: CARD_DECLINED,
        decline_code: STRIPE_DECLINE_CODE,
      }),
    );
    expect(await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).toEqual({
      outcome: VERIFY_OUTCOME.FAILED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
      reason: STRIPE_DECLINE_CODE,
    });
  });

  it('reports canceled as failed', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(paymentIntentReply('canceled', PLAN_MINOR, 'ils'));
    expect(await stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).toEqual({
      outcome: VERIFY_OUTCOME.FAILED,
      providerChargeRef: STRIPE_PAYMENT_INTENT_ID,
      reason: expect.any(String),
    });
  });

  it('reports not found only on an explicit empty search', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(searchReply());
    expect(await stripe.verifyCharge(request(null))).toEqual({ outcome: VERIFY_OUTCOME.NOT_FOUND });
  });

  it('throws when Stripe refuses the lookup, which must never read as "nothing was charged"', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(invalidRequestReply('No such payment_intent'), HTTP_NOT_FOUND);
    await expect(stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).rejects.toThrow();
  });

  it('throws on a currency it does not bill in', async () => {
    const { stripe, wire, request } = await ready();
    wire.reply(paymentIntentReply('succeeded', PLAN_MINOR, 'eur'));
    await expect(stripe.verifyCharge(request(STRIPE_PAYMENT_INTENT_ID))).rejects.toThrow();
  });
});
