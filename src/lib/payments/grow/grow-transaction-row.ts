import { z } from 'zod';
import { zGrowId } from '@/lib/payments/grow/grow-id';

const NO_SUM = '0';

export const zGrowTransactionRow = z.object({
  statusCode: zGrowId,
  status: z.string().default(''),
  sum: zGrowId.default(NO_SUM),
  transactionId: zGrowId.default(''),
  transactionToken: z.string().default(''),
  cardToken: z.string().default(''),
  fullName: z.string().default(''),
  payerPhone: z.string().default(''),
});

export const zTransactionRows = z.object({ transactions: z.array(zGrowTransactionRow) });

export type GrowTransactionRow = z.infer<typeof zGrowTransactionRow>;
