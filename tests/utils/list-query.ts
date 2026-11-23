export type ListQuery = Record<string, string | number>;

export const withQuery = (path: string, query: ListQuery = {}) => {
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  return params.size === 0 ? path : `${path}?${params}`;
};
