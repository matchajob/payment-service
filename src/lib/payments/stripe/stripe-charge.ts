import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { PaymentProvider } from '@/lib/payments/provider';
import { decodeCardToken } from '@/lib/payments/stripe/stripe-card-token';
import { zCardDecline } from '@/lib/payments/stripe/stripe-card-decline';
import type { StripeContext } from '@/lib/payments/stripe/stripe-context';
import { toStripeCurrency } from '@/lib/payments/stripe/stripe-currency';
import { stripeDataOf } from '@/lib/payments/stripe/stripe-data-of';
import { STRIPE_INTENT_STATUS } from '@/lib/payments/stripe/stripe-intent-status';
import { zPaymentIntent } from '@/lib/payments/stripe/stripe-payment-intent';
import { STRIPE_FIELD, STRIPE_PATH, STRIPE_WIRE_VALUE } from '@/lib/payments/stripe/stripe-wire-values';

const HTTP_PAYMENT_REQUIRED = 402;
const NOT_SUCCEEDED = 'stripe accepted the off-session charge but did not report it succeeded';
const DECLINED = 'stripe declined the card';

export const stripeCharge =
  ({ client }: StripeContext): PaymentProvider['charge'] =>
  async ({ paymentMethodToken, amountMinor, currency, dedupKey, chargeSerial }) => {
    const { customer, paymentMethod } = decodeCardToken(paymentMethodToken);
    const reply = await client.post(
      STRIPE_PATH.PAYMENT_INTENTS,
      {
        [STRIPE_FIELD.AMOUNT]: String(amountMinor),
        [STRIPE_FIELD.CURRENCY]: toStripeCurrency(currency),
        [STRIPE_FIELD.CUSTOMER]: customer,
        [STRIPE_FIELD.PAYMENT_METHOD]: paymentMethod,
        [STRIPE_FIELD.OFF_SESSION]: STRIPE_WIRE_VALUE.TRUE,
        [STRIPE_FIELD.CONFIRM]: STRIPE_WIRE_VALUE.TRUE,
        [STRIPE_FIELD.DEDUP_KEY_METADATA]: dedupKey,
        [STRIPE_FIELD.CHARGE_SERIAL_METADATA]: String(chargeSerial),
      },
      dedupKey,
    );
    const decline =
      reply.ok || reply.status !== HTTP_PAYMENT_REQUIRED ? undefined : zCardDecline.safeParse(reply.error);
    if (decline?.success)
      return {
        outcome: CHARGE_STATUS.FAILED,
        providerChargeRef: decline.data.payment_intent?.id,
        reason: decline.data.decline_code ?? decline.data.code ?? decline.data.message ?? DECLINED,
      };
    const intent = stripeDataOf(STRIPE_PATH.PAYMENT_INTENTS, reply, zPaymentIntent);
    if (intent.status === STRIPE_INTENT_STATUS.REQUIRES_ACTION)
      return { outcome: CHARGE_STATUS.FAILED, providerChargeRef: intent.id, reason: intent.status };
    if (intent.status !== STRIPE_INTENT_STATUS.SUCCEEDED) throw new Error(NOT_SUCCEEDED);
    return { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: intent.id };
  };
