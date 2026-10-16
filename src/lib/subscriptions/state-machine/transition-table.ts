import { LIFECYCLE_EVENT, type LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { STATE_KEY, type StateKey } from '@/lib/subscriptions/state-machine/state-key';
import { ACTIVE, ACTIVE_FLAGGED, CANCELED, PAST_DUE } from '@/lib/subscriptions/state-machine/subscription-state';
import type { Row } from '@/lib/subscriptions/state-machine/transition-row';

export type Table = Record<StateKey, Partial<Record<LifecycleEvent, Row>>>;

const { SUBSCRIPTION_ACTIVATED, SUBSCRIPTION_PAST_DUE, SUBSCRIPTION_CANCELED, CHARGE_SUCCEEDED, CHARGE_FAILED } =
  OUTBOUND_EVENT_TYPE;

export const TABLE = {
  [STATE_KEY.INCOMPLETE]: {
    [LIFECYCLE_EVENT.CHECKOUT_COMPLETED]: {
      to: ACTIVE,
      effects: ['store_payment_method', 'start_period', 'charge_first'],
      emits: [],
      selfOnly: true,
    },
    [LIFECYCLE_EVENT.ALREADY_SUBSCRIBED]: { to: CANCELED, effects: [], emits: [SUBSCRIPTION_CANCELED], selfOnly: true },
    [LIFECYCLE_EVENT.CHECKOUT_EXPIRED]: { to: CANCELED, effects: [], emits: [] },
    [LIFECYCLE_EVENT.CANCEL]: { to: CANCELED, effects: [], emits: [] },
  },
  [STATE_KEY.ACTIVE]: {
    [LIFECYCLE_EVENT.FIRST_CHARGE_SUCCEEDED]: {
      to: ACTIVE,
      effects: ['record_charge'],
      emits: [SUBSCRIPTION_ACTIVATED],
      selfOnly: true,
    },
    [LIFECYCLE_EVENT.FIRST_CHARGE_FAILED]: {
      to: CANCELED,
      effects: ['record_charge'],
      emits: [CHARGE_FAILED],
      selfOnly: true,
    },
    [LIFECYCLE_EVENT.RENEWAL_DUE]: { to: ACTIVE, effects: ['charge_renewal'], emits: [], selfOnly: true },
    [LIFECYCLE_EVENT.RENEWAL_SUCCEEDED]: {
      to: ACTIVE,
      effects: ['record_charge', 'advance_period'],
      emits: [CHARGE_SUCCEEDED],
    },
    [LIFECYCLE_EVENT.RENEWAL_FAILED]: {
      to: PAST_DUE,
      effects: ['record_charge', 'start_dunning'],
      emits: [CHARGE_FAILED, SUBSCRIPTION_PAST_DUE],
    },
    [LIFECYCLE_EVENT.CANCEL]: { to: ACTIVE_FLAGGED, effects: [], emits: [], selfOnly: true },
    [LIFECYCLE_EVENT.PAYMENT_METHOD_UPDATED]: {
      to: ACTIVE,
      effects: ['replace_payment_method'],
      emits: [],
      selfOnly: true,
    },
  },
  [STATE_KEY.ACTIVE_FLAGGED]: {
    [LIFECYCLE_EVENT.RENEWAL_DUE]: { to: CANCELED, effects: [], emits: [SUBSCRIPTION_CANCELED], selfOnly: true },
    [LIFECYCLE_EVENT.CANCEL]: { to: ACTIVE_FLAGGED, effects: [], emits: [], selfOnly: true },
    [LIFECYCLE_EVENT.RESUME]: { to: ACTIVE, effects: [], emits: [], requiresResumeAllowed: true, selfOnly: true },
    [LIFECYCLE_EVENT.PAYMENT_METHOD_UPDATED]: {
      to: ACTIVE_FLAGGED,
      effects: ['replace_payment_method'],
      emits: [],
      selfOnly: true,
    },
  },
  [STATE_KEY.PAST_DUE]: {
    [LIFECYCLE_EVENT.RETRY_DUE]: { to: PAST_DUE, effects: ['charge_retry'], emits: [], selfOnly: true },
    [LIFECYCLE_EVENT.RETRY_SUCCEEDED]: {
      to: ACTIVE,
      effects: ['record_charge', 'advance_period', 'reset_dunning'],
      emits: [CHARGE_SUCCEEDED],
    },
    [LIFECYCLE_EVENT.RETRY_FAILED]: {
      to: PAST_DUE,
      effects: ['record_charge', 'schedule_next_retry'],
      emits: [CHARGE_FAILED],
    },
    [LIFECYCLE_EVENT.FINAL_RETRY_FAILED]: {
      to: CANCELED,
      effects: ['record_charge'],
      emits: [CHARGE_FAILED, SUBSCRIPTION_CANCELED],
    },
    [LIFECYCLE_EVENT.CANCEL]: {
      to: CANCELED,
      effects: ['stop_dunning'],
      emits: [SUBSCRIPTION_CANCELED],
      selfOnly: true,
    },
    [LIFECYCLE_EVENT.PAYMENT_METHOD_UPDATED]: {
      to: PAST_DUE,
      effects: ['replace_payment_method', 'retry_now'],
      emits: [],
      selfOnly: true,
    },
    [LIFECYCLE_EVENT.IMMEDIATE_RETRY_FAILED]: {
      to: PAST_DUE,
      effects: ['record_charge', 'restart_dunning'],
      emits: [CHARGE_FAILED],
      selfOnly: true,
    },
  },
  [STATE_KEY.CANCELED]: {},
} satisfies Table;
