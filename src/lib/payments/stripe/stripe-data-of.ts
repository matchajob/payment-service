import { z } from 'zod';
import type { StripeReply } from '@/infra/stripe/stripe-reply';

const REFUSED = 'stripe refused';

const zErrorSummary = z.object({
  type: z.string().optional(),
  code: z.string().optional(),
  decline_code: z.string().optional(),
  message: z.string().optional(),
});

const summaryOf = (error: unknown): string => {
  const summary = zErrorSummary.safeParse(error);
  return summary.success ? JSON.stringify(summary.data) : '';
};

export const stripeDataOf = <T>(path: string, reply: StripeReply, schema: z.ZodType<T>): T => {
  if (!reply.ok) throw new Error(`${REFUSED} ${path}: ${reply.status} ${summaryOf(reply.error)}`);
  return schema.parse(reply.data);
};
