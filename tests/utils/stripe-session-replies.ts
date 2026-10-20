// Shapes follow Stripe's API reference, trimmed to the fields the adapter reads plus a few it must ignore.

export const STRIPE_CUSTOMER_ID = 'cus_QfakeCustomer01';
export const STRIPE_SESSION_ID = 'cs_test_a1FakeSession01';
export const STRIPE_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1FakeSession01';
export const STRIPE_PAYMENT_METHOD_ID = 'pm_1FakePaymentMethod01';
export const STRIPE_SETUP_INTENT_ID = 'seti_1FakeSetupIntent01';

export const customerReply = (id: string = STRIPE_CUSTOMER_ID) => ({ id, object: 'customer', livemode: false });

export const createdSessionReply = (id: string = STRIPE_SESSION_ID) => ({
  id,
  object: 'checkout.session',
  url: STRIPE_CHECKOUT_URL,
  status: 'open',
  livemode: false,
});

type SessionShape = {
  status: string;
  customer?: string | null;
  setupPaymentMethod?: string | null;
  paymentPaymentMethod?: string | null;
};

export const retrievedSessionReply = ({
  status,
  customer = STRIPE_CUSTOMER_ID,
  setupPaymentMethod = null,
  paymentPaymentMethod = null,
}: SessionShape) => ({
  id: STRIPE_SESSION_ID,
  object: 'checkout.session',
  status,
  customer,
  setup_intent:
    setupPaymentMethod === null
      ? null
      : { id: STRIPE_SETUP_INTENT_ID, object: 'setup_intent', status: 'succeeded', payment_method: setupPaymentMethod },
  payment_intent:
    paymentPaymentMethod === null
      ? null
      : {
          id: 'pi_3FakeCheckoutIntent',
          object: 'payment_intent',
          status: 'succeeded',
          payment_method: paymentPaymentMethod,
        },
});

export const completedSetupSessionReply = (paymentMethod: string = STRIPE_PAYMENT_METHOD_ID) =>
  retrievedSessionReply({ status: 'complete', setupPaymentMethod: paymentMethod });
