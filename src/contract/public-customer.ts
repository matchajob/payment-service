import { z } from 'zod';

const EXTERNAL_REF_MAX_LENGTH = 64;

export const publicCustomerSchema = z.object({
  customerId: z.uuid(),
  externalRef: z.string().min(1).max(EXTERNAL_REF_MAX_LENGTH),
});

export type PublicCustomer = z.infer<typeof publicCustomerSchema>;
