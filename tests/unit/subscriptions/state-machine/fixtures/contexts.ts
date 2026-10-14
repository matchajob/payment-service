import type { TransitionContext } from '@/lib/subscriptions/state-machine/transition-context';

export const SELF: TransitionContext = { 
    scheduleOwner: 'self',
    policy: { resumeAllowed: true } };
export const SELF_RESUME_FORBIDDEN: TransitionContext = { 
    scheduleOwner: 'self', 
    policy: { resumeAllowed: false } 
};
export const EXTERNAL: TransitionContext = { 
    scheduleOwner: 'external', 
    policy: { resumeAllowed: true } };
export const EXTERNAL_RESUME_FORBIDDEN: TransitionContext = {
    scheduleOwner: 'external',
    policy: { resumeAllowed: false },
};