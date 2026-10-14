import { z } from 'zod';
import { publicPlanSchema } from '@/contract/public-plan';

export const planListResponseSchema = z.object({ data: z.array(publicPlanSchema) });

export type PlanListResponse = z.infer<typeof planListResponseSchema>;
