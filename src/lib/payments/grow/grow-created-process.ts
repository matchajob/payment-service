import { z } from 'zod';
import { zGrowId } from '@/lib/payments/grow/grow-id';

export const zCreatedProcess = z.object({ url: z.string(), processId: zGrowId, processToken: z.string() });
