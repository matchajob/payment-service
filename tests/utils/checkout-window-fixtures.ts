import { HOUR_MS } from '@tests/utils/reconcile-times';
import { TEST_NOW } from '@tests/utils/test-app';

const TWO_HOURS = 2;
const SECONDS_MS = 1000;

export const CHECKOUT_WINDOW = {
  requestedAt: TEST_NOW,
  expiresAt: new Date(TEST_NOW.getTime() + TWO_HOURS * HOUR_MS),
} as const;

export const unixSeconds = (at: Date): string => String(Math.floor(at.getTime() / SECONDS_MS));
