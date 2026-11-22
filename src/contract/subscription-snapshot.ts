import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';
import { subscriptionStatusSchema } from '@/contract/subscription-status';
import { cancelReasonSchema } from '@/contract/cancel-reason';
import { SUBSCRIPTION_EXAMPLE } from '@/contract/subscription-example';

const EXTERNAL_REF_MAX_LENGTH = 64;

export const subscriptionSnapshotSchema = z
  .object({
    subscriptionId: z.uuid().describe('Unique identifier for the subscription.'),
    customerId: z.uuid().describe('The customer this subscription belongs to.'),
    customerExternalRef: z
      .string()
      .min(1)
      .max(EXTERNAL_REF_MAX_LENGTH)
      .meta({
        description: "The customer's externalRef, so you can match it without a lookup.",
        examples: [EXAMPLE.EXTERNAL_REF],
      }),
    planId: z.uuid().describe('The plan being billed. It never changes on a subscription.'),
    status: subscriptionStatusSchema,
    entitled: z
      .boolean()
      .describe(
        'Whether the customer should have access right now. Computed from the status, the payment history and your grace policy. Grant access from this field, never from status.',
      ),
    currentPeriodEnd: z.iso
      .datetime()
      .nullable()
      .describe(
        'When the paid period ends and the next renewal is due, in ISO 8601 UTC. Null until the first payment.',
      ),
    cancelAtPeriodEnd: z
      .boolean()
      .describe('True when the subscription was canceled and will end at currentPeriodEnd instead of renewing.'),
    cancelReason: cancelReasonSchema.nullable().describe('Why the subscription ended. Null unless canceled.'),
    canceledAt: z.iso
      .datetime()
      .nullable()
      .describe('When the subscription ended, in ISO 8601 UTC. Null unless canceled.'),
  })
  .meta({
    id: 'Subscription',
    title: 'The Subscription object',
    examples: [SUBSCRIPTION_EXAMPLE],
    description:
      'One customer on one plan. Every read, every command and every event returns this same snapshot, so you can store it as is.',
  });

export type SubscriptionSnapshot = z.infer<typeof subscriptionSnapshotSchema>;
