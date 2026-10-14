export const SCHEDULE_OWNER = { SELF: 'self', EXTERNAL: 'external' } as const;

export type ScheduleOwner = (typeof SCHEDULE_OWNER)[keyof typeof SCHEDULE_OWNER];