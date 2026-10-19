import { z } from 'zod';

const zGrowCredentials = z.object({ userId: z.string().min(1), pageCode: z.string().min(1) });

export type GrowCredentials = z.infer<typeof zGrowCredentials>;

export const parseGrowCredentials = (credentials: string): GrowCredentials =>
  zGrowCredentials.parse(JSON.parse(credentials));
