import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import type { CheckoutRequest, PaymentProvider } from '@/lib/payments/provider';
import type { StripeContext } from '@/lib/payments/stripe/stripe-context';
import { zCreatedSession, zStripeObjectId } from '@/lib/payments/stripe/stripe-created';
import { toStripeCurrency } from '@/lib/payments/stripe/stripe-currency';
import { stripeDataOf } from '@/lib/payments/stripe/stripe-data-of';
import { STRIPE_FIELD, STRIPE_PATH, STRIPE_WIRE_VALUE } from '@/lib/payments/stripe/stripe-wire-values';
import type { StripeFields } from '@/infra/stripe/stripe-client';

const returnFields = ({ reference, returnUrl }: CheckoutRequest): StripeFields => ({
  [STRIPE_FIELD.CLIENT_REFERENCE_ID]: reference,
  [STRIPE_FIELD.SUCCESS_URL]: returnUrl,
  [STRIPE_FIELD.CANCEL_URL]: returnUrl,
});

const setupFields = async ({ client }: StripeContext, request: CheckoutRequest): Promise<StripeFields> => {
  const reply = await client.post(STRIPE_PATH.CUSTOMERS, { [STRIPE_FIELD.REFERENCE_METADATA]: request.reference });
  const customer = stripeDataOf(STRIPE_PATH.CUSTOMERS, reply, zStripeObjectId);
  return {
    [STRIPE_FIELD.MODE]: STRIPE_WIRE_VALUE.MODE_SETUP,
    [STRIPE_FIELD.CUSTOMER]: customer.id,
    [STRIPE_FIELD.CURRENCY]: toStripeCurrency(request.currency),
    ...returnFields(request),
  };
};

const paymentFields = (request: CheckoutRequest): StripeFields => ({
  [STRIPE_FIELD.MODE]: STRIPE_WIRE_VALUE.MODE_PAYMENT,
  [STRIPE_FIELD.CUSTOMER_CREATION]: STRIPE_WIRE_VALUE.CUSTOMER_CREATION_ALWAYS,
  [STRIPE_FIELD.SETUP_FUTURE_USAGE]: STRIPE_WIRE_VALUE.OFF_SESSION,
  [STRIPE_FIELD.LINE_ITEM_QUANTITY]: STRIPE_WIRE_VALUE.SINGLE_QUANTITY,
  [STRIPE_FIELD.LINE_ITEM_CURRENCY]: toStripeCurrency(request.currency),
  [STRIPE_FIELD.LINE_ITEM_UNIT_AMOUNT]: String(request.amountMinor),
  [STRIPE_FIELD.LINE_ITEM_NAME]: STRIPE_WIRE_VALUE.LINE_ITEM_NAME,
  ...returnFields(request),
});

export const stripeStartCheckout =
  (context: StripeContext): PaymentProvider['startCheckout'] =>
  async (request) => {
    const fields =
      request.mode === CHECKOUT_MODE.CAPTURE ? await setupFields(context, request) : paymentFields(request);
    const reply = await context.client.post(STRIPE_PATH.CHECKOUT_SESSIONS, fields);
    const session = stripeDataOf(STRIPE_PATH.CHECKOUT_SESSIONS, reply, zCreatedSession);
    return { checkoutUrl: session.url, providerSessionRef: session.id };
  };
