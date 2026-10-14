import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import type { TransitionContext } from '@/lib/subscriptions/state-machine/transition-context';

export const SELF: TransitionContext = { scheduleOwner: SCHEDULE_OWNER.SELF, policy: { resumeAllowed: true } };

export const SELF_RESUME_FORBIDDEN: TransitionContext = {
  scheduleOwner: SCHEDULE_OWNER.SELF,
  policy: { resumeAllowed: false },
};

export const EXTERNAL: TransitionContext = { scheduleOwner: SCHEDULE_OWNER.EXTERNAL, policy: { resumeAllowed: true } };

export const EXTERNAL_RESUME_FORBIDDEN: TransitionContext = {
  scheduleOwner: SCHEDULE_OWNER.EXTERNAL,
  policy: { resumeAllowed: false },
};
