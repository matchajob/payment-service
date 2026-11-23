import { z } from 'zod';

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export const listQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(MIN_LIMIT)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe('How many items to return, newest first. Between 1 and 100, 25 by default.'),
  startingAfter: z
    .uuid()
    .optional()
    .describe('The id of the last item of the previous page. Omit it for the first page.'),
});
