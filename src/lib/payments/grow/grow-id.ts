import { z } from 'zod';

export const zGrowId = z.union([z.string(), z.number()]).transform(String);
