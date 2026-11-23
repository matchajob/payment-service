export type QueryValues = Record<string, string | number | undefined>;

export const withQueryString = (path: string, query: QueryValues): string => {
  const params = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]])),
  );
  return params.size === 0 ? path : `${path}?${params}`;
};
