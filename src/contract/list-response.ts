import { z, type ZodType } from 'zod';

export const listResponseSchema = <Item extends ZodType>(item: Item, description: string) =>
  z.object({
    data: z.array(item).describe(description),
    hasMore: z
      .boolean()
      .describe("Whether more items follow. Pass the last item's id as `startingAfter` to fetch them."),
  });
