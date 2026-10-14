import type { Context } from 'hono';
import type { Problem } from '@/contract/problem';
import { PROBLEM_TITLE, type ProblemStatus } from '@/api/problem-title';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';
const DEFAULT_TYPE = 'about:blank';

export const problemResponse = (c: Context, status: ProblemStatus, detail?: string) => {
  const body: Problem = { type: DEFAULT_TYPE, title: PROBLEM_TITLE[status], status, detail };
  return c.body(JSON.stringify(body), status, { 'content-type': PROBLEM_CONTENT_TYPE });
};