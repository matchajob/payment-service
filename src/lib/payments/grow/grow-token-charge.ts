import { z } from 'zod';
import { zGrowId } from '@/lib/payments/grow/grow-id';

export const zTokenCharge = z.object({ statusCode: zGrowId, transactionId: zGrowId, transactionToken: z.string() });
