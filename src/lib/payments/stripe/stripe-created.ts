import { z } from 'zod';

export const zStripeObjectId = z.object({ id: z.string() });

export const zCreatedSession = z.object({ id: z.string(), url: z.string() });
