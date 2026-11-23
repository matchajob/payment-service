import { z } from 'zod';
import { chargeStatusSchema } from '@/contract/charge-status';
import { EXAMPLE } from '@/contract/contract-examples';

export const publicChargeSchema = z
  .object({
    chargeId: z.uuid().describe('Unique identifier for the charge.'),
    subscriptionId: z.uuid().describe('The subscription this charge bills.'),
    kind: z
      .enum(['first', 'renewal', 'retry', 'immediate_retry'])
      .describe(
        'first: the checkout payment. renewal: the charge for a new period. retry: a scheduled retry after a failed renewal. immediate_retry: a retry right after the customer updated their card.',
      ),
    amountMinor: z.int().positive().describe('The amount in minor units: agorot for ILS, cents for USD.'),
    currency: z.enum(['ILS', 'USD']).describe('Three-letter ISO currency code.'),
    status: chargeStatusSchema,
    failureReason: z
      .string()
      .nullable()
      .describe("The provider's reason for a failed charge, as the provider worded it. Null otherwise."),
    attemptedAt: z.iso.datetime().describe('When the charge was sent to the provider, in ISO 8601 UTC.'),
  })
  .meta({
    id: 'Charge',
    title: 'The Charge object',
    description: 'One attempt to take money for a subscription. A retry is a new charge.',
    examples: [
      {
        chargeId: EXAMPLE.CHARGE_ID,
        subscriptionId: EXAMPLE.SUBSCRIPTION_ID,
        kind: 'renewal',
        amountMinor: EXAMPLE.AMOUNT_MINOR,
        currency: 'ILS',
        status: 'failed',
        failureReason: EXAMPLE.DECLINE_REASON,
        attemptedAt: EXAMPLE.OCCURRED_AT,
      },
    ],
  });

export type PublicCharge = z.infer<typeof publicChargeSchema>;
