export const STRIPE_PATH = {
  CUSTOMERS: '/v1/customers',
  CHECKOUT_SESSIONS: '/v1/checkout/sessions',
  PAYMENT_INTENTS: '/v1/payment_intents',
  PAYMENT_INTENTS_SEARCH: '/v1/payment_intents/search',
} as const;

export const STRIPE_WIRE_VALUE = {
  MODE_SETUP: 'setup',
  MODE_PAYMENT: 'payment',
  CUSTOMER_CREATION_ALWAYS: 'always',
  OFF_SESSION: 'off_session',
  TRUE: 'true',
  SINGLE_QUANTITY: '1',
  LINE_ITEM_NAME: 'Subscription',
  EXPAND_PAYMENT_INTENT: 'payment_intent',
  EXPAND_SETUP_INTENT: 'setup_intent',
  SESSION_COMPLETE: 'complete',
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CARD_ERROR: 'card_error',
} as const;

export const STRIPE_METADATA_KEY = { DEDUP_KEY: 'dedup_key', CHARGE_SERIAL: 'charge_serial' } as const;

export const STRIPE_FIELD = {
  MODE: 'mode',
  CUSTOMER: 'customer',
  CUSTOMER_CREATION: 'customer_creation',
  CURRENCY: 'currency',
  CLIENT_REFERENCE_ID: 'client_reference_id',
  SUCCESS_URL: 'success_url',
  CANCEL_URL: 'cancel_url',
  SETUP_FUTURE_USAGE: 'payment_intent_data[setup_future_usage]',
  LINE_ITEM_QUANTITY: 'line_items[0][quantity]',
  LINE_ITEM_CURRENCY: 'line_items[0][price_data][currency]',
  LINE_ITEM_UNIT_AMOUNT: 'line_items[0][price_data][unit_amount]',
  LINE_ITEM_NAME: 'line_items[0][price_data][product_data][name]',
  REFERENCE_METADATA: 'metadata[reference]',
  AMOUNT: 'amount',
  PAYMENT_METHOD: 'payment_method',
  OFF_SESSION: 'off_session',
  CONFIRM: 'confirm',
  DEDUP_KEY_METADATA: `metadata[${STRIPE_METADATA_KEY.DEDUP_KEY}]`,
  CHARGE_SERIAL_METADATA: `metadata[${STRIPE_METADATA_KEY.CHARGE_SERIAL}]`,
  EXPAND: 'expand[]',
  QUERY: 'query',
} as const;
