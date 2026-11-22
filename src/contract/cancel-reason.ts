import { z } from 'zod';

export const cancelReasonSchema = z
  .enum(['payment_failure', 'customer_request', 'already_subscribed', 'checkout_expired'])
  .describe(
    'Why the subscription ended. payment_failure: the first payment or the last retry was declined. customer_request: you canceled it. already_subscribed: the customer paid while another of their subscriptions was live. checkout_expired: nobody paid within the checkout window.',
  );
