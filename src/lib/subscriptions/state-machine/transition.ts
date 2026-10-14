import type { Effect } from '@/lib/subscriptions/state-machine/effects';
import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import type { OutboundEventType } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { stateKey } from '@/lib/subscriptions/state-machine/state-key';
import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import { TABLE } from '@/lib/subscriptions/state-machine/transition-table';

export type TenantPolicy = { resumeAllowed: boolean };

export type Outcome =
  | { kind: 'accepted'; to: SubscriptionState; effects: readonly Effect[]; emits: readonly OutboundEventType[] }
  | { kind: 'rejected'; reason: string };

export const transition = (state: SubscriptionState, event: LifecycleEvent, policy: TenantPolicy): Outcome => {
    const key = stateKey(state);
    const row = TABLE[key][event];
    if (row === undefined) return { kind: 'rejected', reason: `${key} does not accept ${event}` };
    if (row.requiresResumeAllowed && !policy.resumeAllowed) {
    return { kind: 'rejected', reason: 'tenant policy does not allow resume' };
  }
  return { kind: 'accepted', to: row.to, effects: row.effects, emits: row.emits };
};
