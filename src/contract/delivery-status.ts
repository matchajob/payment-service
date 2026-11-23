import { z } from 'zod';

export const deliveryStatusSchema = z
  .enum(['pending', 'delivered', 'dead'])
  .describe(
    'pending: queued or being retried. delivered: your endpoint answered 2xx. dead: retries ran out. Redrive it once your endpoint is fixed.',
  );
