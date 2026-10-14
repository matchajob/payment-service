import type { Effect } from '@/lib/subscriptions/state-machine/effects';
import type { OutboundEventType } from '@/lib/subscriptions/state-machine/outbound-event-types';
import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';

export type Row = {
  to: SubscriptionState;
  effects: readonly Effect[];
  emits: readonly OutboundEventType[];
  requiresResumeAllowed?: true;
  selfOnly?: true;
};
