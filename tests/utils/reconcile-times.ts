import { DAY_MS } from '@/lib/time/day-ms';

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const GIVE_UP_DAYS = 7;
const IN_FLIGHT_MINUTES = 15;

export const HOUR_MS = DAY_MS / HOURS_PER_DAY;
export const MINUTE_MS = HOUR_MS / MINUTES_PER_HOUR;

export const IN_FLIGHT_MS = IN_FLIGHT_MINUTES * MINUTE_MS;
export const NOT_FOUND_GRACE_MS = DAY_MS;
export const GIVE_UP_MS = GIVE_UP_DAYS * DAY_MS;

export const after = (start: Date, ms: number): Date => new Date(start.getTime() + ms);
