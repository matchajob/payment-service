import type { CheckoutRequest } from '@/lib/payments/provider';
import { HOUR_MS } from '@/lib/time/hour-ms';

export const checkoutWindow = (now: Date, ttlHours: number): Pick<CheckoutRequest, 'requestedAt' | 'expiresAt'> => ({
  requestedAt: now,
  expiresAt: new Date(now.getTime() + ttlHours * HOUR_MS),
});
