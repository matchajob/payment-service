import type { z } from 'zod';
import { listResponseSchema } from '@/contract/list-response';
import { publicChargeSchema } from '@/contract/public-charge';

export const chargeListResponseSchema = listResponseSchema(publicChargeSchema, 'Your charges, newest first.');

export type ChargeListResponse = z.infer<typeof chargeListResponseSchema>;
