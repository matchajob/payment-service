const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

const RETRY_DELAYS_MS = [
  5 * MS_PER_SECOND,
  5 * MS_PER_MINUTE,
  30 * MS_PER_MINUTE,
  2 * MS_PER_HOUR,
  5 * MS_PER_HOUR,
  10 * MS_PER_HOUR,
  10 * MS_PER_HOUR,
] as const;

export const MAX_DELIVERY_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export const retryDelayAfter = (failedAttempts: number): number | undefined => RETRY_DELAYS_MS[failedAttempts - 1];
