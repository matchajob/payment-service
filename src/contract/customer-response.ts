import { z } from 'zod';
import { publicCustomerSchema } from '@/contract/public-customer';

export const customerResponseSchema = z.object({ data: publicCustomerSchema });

export type CustomerResponse = z.infer<typeof customerResponseSchema>;
