export type HeaderBag = Headers | Readonly<Record<string, string | undefined>>;

export const readHeader = (headers: HeaderBag, name: string): string | undefined => {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const wanted = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === wanted)?.[1];
};
