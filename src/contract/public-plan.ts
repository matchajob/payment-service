import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';

const NAME_MAX_LENGTH = 64;

export const publicPlanSchema = z
  .object({
    planId: z.uuid().describe('Unique identifier for the plan.'),
    name: z
      .string()
      .min(1)
      .max(NAME_MAX_LENGTH)
      .meta({
        description: 'The plan name. It is also the line description on tax invoices.',
        examples: [EXAMPLE.PLAN_NAME],
      }),
    amountMinor: z
      .int()
      .positive()
      .meta({
        description: 'The price per interval in minor units: agorot for ILS, cents for USD. 4900 is 49.00.',
        examples: [EXAMPLE.AMOUNT_MINOR],
      }),
    // TODO should ne merged with existing enums
    currency: z.enum(['ILS', 'USD']).describe('Three-letter ISO currency code.'),
    interval: z.enum(['month', 'year']).describe('How often the subscription renews.'),
  })
  .meta({
    id: 'Plan',
    title: 'The Plan object',
    examples: [
      {
        planId: EXAMPLE.PLAN_ID,
        name: EXAMPLE.PLAN_NAME,
        amountMinor: EXAMPLE.AMOUNT_MINOR,
        currency: 'ILS',
        interval: 'month',
      },
    ],
    description:
      'A price your customers subscribe to. Plans never change after they are created: a new price is a new plan.',
  });

export type PublicPlan = z.infer<typeof publicPlanSchema>;
