import { listQuerySchema } from '@/contract/list-query';
import { subscriptionStatusSchema } from '@/contract/subscription-status';

export const subscriptionListQuerySchema = listQuerySchema.extend({
  status: subscriptionStatusSchema.optional(),
});
