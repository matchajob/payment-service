import type { CheckoutRequest } from '@/lib/payments/provider';
import { HOUR_MS } from '@/lib/time/hour-ms';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const SHORTEST_MS = 30 * MINUTE_MS;
// Stripe refuses more than 24h from its own clock; an hour below that absorbs skew between our clock and Stripe's.
const LONGEST_MS = 23 * HOUR_MS;

export const stripeSessionExpiry = ({ requestedAt, expiresAt }: CheckoutRequest): string => {
  const from = requestedAt.getTime();
  const clamped = Math.min(Math.max(expiresAt.getTime(), from + SHORTEST_MS), from + LONGEST_MS);
  return String(Math.floor(clamped / SECOND_MS));
};
