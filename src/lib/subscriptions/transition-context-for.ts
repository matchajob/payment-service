import type { Subscription } from '@/lib/subscriptions/schema';
import type { TransitionContext } from '@/lib/subscriptions/state-machine/transition-context';
import type { Tenant } from '@/lib/tenants/schema';

export const transitionContextFor = (
  { scheduleOwner }: Pick<Subscription, 'scheduleOwner'>,
  { resumeAllowed }: Pick<Tenant, 'resumeAllowed'>,
): TransitionContext => ({ scheduleOwner, policy: { resumeAllowed } });
