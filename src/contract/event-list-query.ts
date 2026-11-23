import { deliveryStatusSchema } from '@/contract/delivery-status';
import { listQuerySchema } from '@/contract/list-query';

export const eventListQuerySchema = listQuerySchema.extend({ deliveryStatus: deliveryStatusSchema.optional() });
