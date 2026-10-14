import { z } from 'zod';

const NAME_MAX_LENGTH = 64;

export const publicPlanSchema = z.object({
  planId: z.uuid(),
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  amountMinor: z.int().positive(),
  // TODO should ne merged with existing enums
  currency: z.enum(['ILS', 'USD']),
  interval: z.enum(['month', 'year']),
});

export type PublicPlan = z.infer<typeof publicPlanSchema>;