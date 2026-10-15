import { z } from 'zod';

export const subscriptionStatusSchema = z.enum(['incomplete', 'active', 'past_due', 'canceled']);
