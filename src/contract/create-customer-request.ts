import { z } from 'zod';
import { publicCustomerSchema } from '@/contract/public-customer';

export const createCustomerRequestSchema = publicCustomerSchema
  .pick({ externalRef: true, name: true, email: true, taxId: true })
  .partial({ name: true, email: true, taxId: true });

export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
