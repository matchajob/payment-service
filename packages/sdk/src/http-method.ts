export const HTTP_METHOD = { GET: 'GET', POST: 'POST' } as const;

export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];
