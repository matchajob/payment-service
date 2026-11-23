import type { Context } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';

const UNKNOWN_CURSOR_DETAIL = 'startingAfter is not an id from this list';

export const unknownCursorResponse = (c: Context<AppEnv>) =>
  problemResponse(c, HTTP_STATUS.BAD_REQUEST, UNKNOWN_CURSOR_DETAIL);
