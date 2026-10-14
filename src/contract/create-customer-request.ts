import { z } from 'zod';
import { publicCustomerSchema } from '@/contract/public-customer';

export const createCustomerRequestSchema = publicCustomerSchema.pick({ externalRef: true });

export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
