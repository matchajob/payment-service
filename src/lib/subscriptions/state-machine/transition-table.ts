import type { Effect } from '@/lib/subscriptions/state-machine/effects';
import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import type { OutboundEventType } from '@/lib/subscriptions/state-machine/outbound-event-types';
import type { StateKey } from '@/lib/subscriptions/state-machine/state-key';
import {
  ACTIVE,
  ACTIVE_FLAGGED,
  CANCELED,
  PAST_DUE,
  type SubscriptionState,
} from '@/lib/subscriptions/state-machine/subscription-state';

export type Row = {
    to: SubscriptionState;
    effects: readonly Effect[];
    emits: readonly OutboundEventType[];
    requiresResumeAllowed?: true;
};

export const TABLE: Record<StateKey, Partial<Record<LifecycleEvent, Row>>> = {
    incomplete: {
        checkout_completed: {
            to: ACTIVE,
            effects: ['record_charge', 'store_payment_method', 'start_period'],
            emits: ['subscription.activated'],
        },
        checkout_expired: {to: CANCELED, effects: [], emits: [] },
        cancel: { to: CANCELED, effects: [], emits: [] },
    },
    active: {
        renewal_due: { to: ACTIVE, effects: ['charge_renewal'], emits: [] },
        renewal_succeeded: { to: ACTIVE, effects: ['record_charge', 'advance_period'], emits: ['charge.succeeded'] },
        renewal_failed: {
            to: PAST_DUE,
            effects: ['record_charge', 'start_dunning'],
            emits: ['charge.failed', 'subscription.past_due'],
        },
        cancel: { to: ACTIVE_FLAGGED, effects: [], emits: [] },
        payment_method_updated: { to: ACTIVE, effects: ['replace_payment_method'], emits: [] },
    },
    active_flagged: {
        renewal_due: { to: CANCELED, effects: [], emits: ['subscription.canceled'] },
        cancel: { to: ACTIVE_FLAGGED, effects: [], emits: [] },
        resume: { to: ACTIVE, effects: [], emits: [], requiresResumeAllowed: true },
        payment_method_updated: { to: ACTIVE_FLAGGED, effects: ['replace_payment_method'], emits: [] },
    },
    past_due: {
        retry_succeeded: {
            to: ACTIVE,
            effects: ['record_charge', 'advance_period', 'reset_dunning'],
            emits: ['charge.succeeded'],
        },
        retry_failed: { to: PAST_DUE, effects: ['record_charge', 'schedule_next_retry'], emits: [] },
        final_retry_failed: { to: CANCELED, effects: ['record_charge'], emits: ['subscription.canceled'] },
        cancel: { to: CANCELED, effects: [], emits: ['subscription.canceled'] },
        payment_method_updated: { to: PAST_DUE, effects: ['replace_payment_method', 'retry_now'], emits: [] },
        immediate_retry_failed: { to: PAST_DUE, effects: ['record_charge', 'restart_dunning'], emits: [] },
    },
    canceled: {},
};