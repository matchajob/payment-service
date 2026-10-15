import type { Context } from 'hono';

export const readJsonBody = (c: Context): Promise<unknown> => c.req.json().catch(() => undefined);
