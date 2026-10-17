import { DAY_MS } from '@/lib/time/day-ms';

const MS_PER_MINUTE = 60_000;
const IN_FLIGHT_MINUTES = 15;
const GIVE_UP_DAYS = 7;

export const RECONCILE_WINDOW = {
  IN_FLIGHT_MS: IN_FLIGHT_MINUTES * MS_PER_MINUTE,
  NOT_FOUND_GRACE_MS: DAY_MS,
  GIVE_UP_MS: GIVE_UP_DAYS * DAY_MS,
} as const;
