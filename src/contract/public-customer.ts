import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';

const EXTERNAL_REF_MAX_LENGTH = 64;
const BILLING_TEXT_MAX_LENGTH = 64;
const EMAIL_MAX_LENGTH = 254;

export const publicCustomerSchema = z
  .object({
    customerId: z.uuid().describe('Unique identifier for the customer.'),
    externalRef: z
      .string()
      .min(1)
      .max(EXTERNAL_REF_MAX_LENGTH)
      .meta({
        description: 'Your own identifier for this customer, such as your user id. Unique within your application.',
        examples: [EXAMPLE.EXTERNAL_REF],
      }),
    name: z
      .string()
      .min(1)
      .max(BILLING_TEXT_MAX_LENGTH)
      .nullable()
      .meta({
        description: 'The customer or business name printed on tax invoices.',
        examples: [EXAMPLE.CUSTOMER_NAME],
      }),
    email: z
      .email()
      .max(EMAIL_MAX_LENGTH)
      .nullable()
      .meta({ description: 'The email address tax invoices are sent to.', examples: [EXAMPLE.CUSTOMER_EMAIL] }),
    taxId: z
      .string()
      .min(1)
      .max(BILLING_TEXT_MAX_LENGTH)
      .nullable()
      .meta({
        description:
          'A company number or personal id for tax invoices. Give it for business customers; large invoices need it for an allocation number.',
        examples: [EXAMPLE.TAX_ID],
      }),
  })
  .meta({
    id: 'Customer',
    title: 'The Customer object',
    examples: [
      {
        customerId: EXAMPLE.CUSTOMER_ID,
        externalRef: EXAMPLE.EXTERNAL_REF,
        name: EXAMPLE.CUSTOMER_NAME,
        email: EXAMPLE.CUSTOMER_EMAIL,
        taxId: null,
      },
    ],
    description:
      'One of your users. A customer outlives its subscriptions, so a returning user keeps the same customer.',
  });

export type PublicCustomer = z.infer<typeof publicCustomerSchema>;
