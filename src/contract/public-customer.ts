import { z } from 'zod';

const EXTERNAL_REF_MAX_LENGTH = 64;
const BILLING_TEXT_MAX_LENGTH = 64;
const EMAIL_MAX_LENGTH = 254;

export const publicCustomerSchema = z.object({
  customerId: z.uuid(),
  externalRef: z.string().min(1).max(EXTERNAL_REF_MAX_LENGTH),
  name: z.string().min(1).max(BILLING_TEXT_MAX_LENGTH).nullable(),
  email: z.email().max(EMAIL_MAX_LENGTH).nullable(),
  taxId: z.string().min(1).max(BILLING_TEXT_MAX_LENGTH).nullable(),
});

export type PublicCustomer = z.infer<typeof publicCustomerSchema>;
