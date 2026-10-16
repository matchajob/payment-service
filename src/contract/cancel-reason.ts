import { z } from 'zod';

export const cancelReasonSchema = z.enum([
  'payment_failure',
  'customer_request',
  'already_subscribed',
  'checkout_expired',
]);
