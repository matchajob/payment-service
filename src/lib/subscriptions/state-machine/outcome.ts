import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import type { RejectionReason } from '@/lib/subscriptions/state-machine/rejection-reason';
import type { Effect } from '@/lib/subscriptions/state-machine/effects';
import type { OutboundEventType } from '@/lib/subscriptions/state-machine/outbound-event-types';

export const OUTCOME_KIND = { ACCEPTED: 'accepted', REJECTED: 'rejected' } as const;

export type Outcome =
  | {
      kind: typeof OUTCOME_KIND.ACCEPTED;
      to: SubscriptionState;
      effects: readonly Effect[];
      emits: readonly OutboundEventType[];
    }
  | {
      kind: typeof OUTCOME_KIND.REJECTED;
      reason: RejectionReason;
    };
