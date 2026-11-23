export const LIST_OUTCOME = {
  LISTED: 'listed',
  UNKNOWN_CURSOR: 'unknown_cursor',
} as const;

export type ListFilter<Id> = { limit: number; startingAfter?: Id | undefined };

export type ListResult<Item> =
  | { outcome: typeof LIST_OUTCOME.LISTED; items: Item[]; hasMore: boolean }
  | { outcome: typeof LIST_OUTCOME.UNKNOWN_CURSOR };

export const UNKNOWN_CURSOR = { outcome: LIST_OUTCOME.UNKNOWN_CURSOR } as const;

export const listed = <Item>(rows: Item[], limit: number): ListResult<Item> => ({
  outcome: LIST_OUTCOME.LISTED,
  items: rows.slice(0, limit),
  hasMore: rows.length > limit,
});

export const oneMoreThan = (limit: number) => limit + 1;
