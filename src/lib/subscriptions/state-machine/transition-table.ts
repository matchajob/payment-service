import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { STATE_KEY, type StateKey } from '@/lib/subscriptions/state-machine/state-key';
import { ACTIVE, ACTIVE_FLAGGED, CANCELED, PAST_DUE } from '@/lib/subscriptions/state-machine/subscription-state';
import type { Row } from '@/lib/subscriptions/state-machine/transition-row';

export type Table = Record<StateKey, Partial<Record<LifecycleEvent, Row>>>;

export const TABLE = {
  [STATE_KEY.INCOMPLETE]: {
    checkout_completed: {
      to: ACTIVE,
      effects: ['record_charge', 'store_payment_method', 'start_period'],
      emits: ['subscription.activated'],
    },
    checkout_expired: { to: CANCELED, effects: [], emits: [] },
    cancel: { to: CANCELED, effects: [], emits: [] },
  },
  [STATE_KEY.ACTIVE]: {
    renewal_due: { to: ACTIVE, effects: ['charge_renewal'], emits: [], selfOnly: true },
    renewal_succeeded: { to: ACTIVE, effects: ['record_charge', 'advance_period'], emits: ['charge.succeeded'] },
    renewal_failed: {
      to: PAST_DUE,
      effects: ['record_charge', 'start_dunning'],
      emits: ['charge.failed', 'subscription.past_due'],
    },
    cancel: { to: ACTIVE_FLAGGED, effects: [], emits: [], selfOnly: true },
    payment_method_updated: { to: ACTIVE, effects: ['replace_payment_method'], emits: [], selfOnly: true },
  },
  [STATE_KEY.ACTIVE_FLAGGED]: {
    renewal_due: { to: CANCELED, effects: [], emits: ['subscription.canceled'], selfOnly: true },
    cancel: { to: ACTIVE_FLAGGED, effects: [], emits: [], selfOnly: true },
    resume: { to: ACTIVE, effects: [], emits: [], requiresResumeAllowed: true, selfOnly: true },
    payment_method_updated: { to: ACTIVE_FLAGGED, effects: ['replace_payment_method'], emits: [], selfOnly: true },
  },
  [STATE_KEY.PAST_DUE]: {
    retry_due: { to: PAST_DUE, effects: ['charge_retry'], emits: [], selfOnly: true },
    retry_succeeded: {
      to: ACTIVE,
      effects: ['record_charge', 'advance_period', 'reset_dunning'],
      emits: ['charge.succeeded'],
    },
    retry_failed: { to: PAST_DUE, effects: ['record_charge', 'schedule_next_retry'], emits: [] },
    final_retry_failed: { to: CANCELED, effects: ['record_charge'], emits: ['subscription.canceled'] },
    cancel: { to: CANCELED, effects: ['stop_dunning'], emits: ['subscription.canceled'], selfOnly: true },
    payment_method_updated: {
      to: PAST_DUE,
      effects: ['replace_payment_method', 'retry_now'],
      emits: [],
      selfOnly: true,
    },
    immediate_retry_failed: { to: PAST_DUE, effects: ['record_charge', 'restart_dunning'], emits: [], selfOnly: true },
  },
  [STATE_KEY.CANCELED]: {},
} satisfies Table;
