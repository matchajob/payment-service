// Shapes follow Stripe's API reference, trimmed to the fields the adapter reads plus a few it must ignore.

export const STRIPE_PAYMENT_INTENT_ID = 'pi_3FakePaymentIntent01';
export const STRIPE_DECLINE_CODE = 'insufficient_funds';
export const STRIPE_DECLINE_MESSAGE = 'Your card has insufficient funds.';
export const HTTP_PAYMENT_REQUIRED = 402;
export const STRIPE_DEDUP_KEY = 'c1a7e3f0-8b2d-4e5f-9a6b-7c8d9e0f1a2b:2026-02-15T10:00:00.000Z:0';
export const STRIPE_CARD_PAYMENT_METHOD_ID = 'pm_1DeclinedCardPrivate';

export const paymentIntentReply = (
  status: string,
  amount: number,
  currency: string,
  lastError: { code: string; decline_code?: string } | null = null,
  dedupKey: string = STRIPE_DEDUP_KEY,
) => ({
  id: STRIPE_PAYMENT_INTENT_ID,
  object: 'payment_intent',
  status,
  amount,
  amount_received: status === 'succeeded' ? amount : 0,
  currency,
  last_payment_error: lastError,
  metadata: { dedup_key: dedupKey, charge_serial: '41' },
  livemode: false,
});

export const searchReply = (...intents: object[]) => ({
  object: 'search_result',
  url: '/v1/payment_intents/search',
  has_more: false,
  data: intents,
});

export const cardDeclinedReply = (
  code: string = 'card_declined',
  declineCode: string | null = STRIPE_DECLINE_CODE,
) => ({
  error: {
    type: 'card_error',
    code,
    ...(declineCode === null ? {} : { decline_code: declineCode }),
    message: STRIPE_DECLINE_MESSAGE,
    payment_intent: { id: STRIPE_PAYMENT_INTENT_ID, object: 'payment_intent', status: 'requires_payment_method' },
    payment_method: { id: STRIPE_CARD_PAYMENT_METHOD_ID, object: 'payment_method' },
  },
});

export const invalidRequestReply = (message: string) => ({ error: { type: 'invalid_request_error', message } });
