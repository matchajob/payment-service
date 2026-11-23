import { chargeStatusSchema } from '@/contract/charge-status';
import { listQuerySchema } from '@/contract/list-query';

export const chargeListQuerySchema = listQuerySchema.extend({ status: chargeStatusSchema.optional() });
