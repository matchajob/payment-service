import type { z } from 'zod';

const NOT_OURS = 'not a ref this Grow adapter issued';

export const decodeGrowRef = <T>(schema: z.ZodType<T>, ref: string): T => {
  try {
    return schema.parse(JSON.parse(ref));
  } catch {
    throw new Error(NOT_OURS);
  }
};
