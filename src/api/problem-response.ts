import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Problem } from '@/contract/problem';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';
const DEFAULT_TYPE = 'about:blank';

export const problemResponse = (c: Context, status: ContentfulStatusCode, title: string, detail?: string) => {
  const body: Problem = { type: DEFAULT_TYPE, title, status, detail };
  return c.body(JSON.stringify(body), status, { 'content-type': PROBLEM_CONTENT_TYPE });
};
