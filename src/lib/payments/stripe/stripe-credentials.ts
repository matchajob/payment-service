import { z } from 'zod';

const zStripeCredentials = z.object({ secretKey: z.string().min(1) });

export type StripeCredentials = z.infer<typeof zStripeCredentials>;

export const parseStripeCredentials = (credentials: string): StripeCredentials =>
  zStripeCredentials.parse(JSON.parse(credentials));
