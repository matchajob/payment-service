import type { Context } from 'hono';

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'Bearer ';

export const readBearerToken = (c: Context): string | undefined => {
  const header = c.req.header(AUTHORIZATION_HEADER);
  return header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
};
