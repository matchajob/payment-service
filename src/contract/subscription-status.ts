import { z } from 'zod';

export const subscriptionStatusSchema = z
  .enum(['incomplete', 'active', 'past_due', 'canceled'])
  .describe(
    'incomplete: waiting for the first payment. active: paid through currentPeriodEnd. past_due: a renewal failed and retries are running. canceled: ended for good.',
  );
