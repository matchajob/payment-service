import { z } from 'zod';

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int().min(400).max(599), //TODO can be more specific
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type Problem = z.infer<typeof problemSchema>;
