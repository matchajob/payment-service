import type { ScheduleOwner } from '@/lib/subscriptions/state-machine/schedule-owner';

export type TenantPolicy = { resumeAllowed: boolean };

export type TransitionContext = { scheduleOwner: ScheduleOwner; policy: TenantPolicy };