import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND, type Outcome } from '@/lib/subscriptions/state-machine/outcome';
import { REJECTION_REASON } from '@/lib/subscriptions/state-machine/rejection-reason';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { stateKey } from '@/lib/subscriptions/state-machine/state-key';
import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import type { TransitionContext } from '@/lib/subscriptions/state-machine/transition-context';
import { TABLE, type Table } from '@/lib/subscriptions/state-machine/transition-table';

const LOOKUP: Table = TABLE;
export const transition = (
  state: SubscriptionState,
  event: LifecycleEvent,
  { scheduleOwner, policy }: TransitionContext,
): Outcome => {
  const row = LOOKUP[stateKey(state)][event];
  if (row === undefined) {
    return { kind: OUTCOME_KIND.REJECTED, reason: REJECTION_REASON.NOT_ACCEPTED_IN_STATE };
  }
  if (row.selfOnly && scheduleOwner === SCHEDULE_OWNER.EXTERNAL) {
return { kind: OUTCOME_KIND.REJECTED, reason: REJECTION_REASON.STORE_MANAGED };
  }
  if (row.requiresResumeAllowed && !policy.resumeAllowed) {
    return { kind: OUTCOME_KIND.REJECTED, reason: REJECTION_REASON.RESUME_NOT_ALLOWED };
  }
  return { kind: OUTCOME_KIND.ACCEPTED, to: row.to, effects: row.effects, emits: row.emits };
};