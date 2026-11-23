import { z } from 'zod';

export const chargeStatusSchema = z
  .enum(['pending', 'succeeded', 'failed'])
  .describe(
    'pending: sent to the provider, outcome not known yet. succeeded: the money was taken. failed: the provider declined or the attempt errored.',
  );
