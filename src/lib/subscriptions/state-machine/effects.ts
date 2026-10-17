export const EFFECT = {
  RECORD_CHARGE: 'record_charge',
  STORE_PAYMENT_METHOD: 'store_payment_method',
  REPLACE_PAYMENT_METHOD: 'replace_payment_method',
  START_PERIOD: 'start_period',
  ADVANCE_PERIOD: 'advance_period',
  CHARGE_RENEWAL: 'charge_renewal',
  RETRY_NOW: 'retry_now',
  START_DUNNING: 'start_dunning',
  SCHEDULE_NEXT_RETRY: 'schedule_next_retry',
  RESET_DUNNING: 'reset_dunning',
  RESTART_DUNNING: 'restart_dunning',
  CHARGE_RETRY: 'charge_retry',
  CHARGE_FIRST: 'charge_first',
  STOP_DUNNING: 'stop_dunning',
} as const;

export type Effect = (typeof EFFECT)[keyof typeof EFFECT];
