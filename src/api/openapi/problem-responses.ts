import { HTTP_STATUS } from '@/api/http-status';
import { PROBLEM_CONTENT_TYPE } from '@/api/problem-content-type';
import type { OpenApiResponse } from '@/api/openapi/openapi-types';
import { componentRef } from '@/api/openapi/to-openapi-schema';
import { RETRY_AFTER_HEADER } from '@/api/retry-after';
import { problemSchema } from '@/contract/problem';
import { z } from 'zod';

const PROBLEM_ID = z.globalRegistry.get(problemSchema)?.id ?? '';

export const RETRY_WITH_SAME_KEY = 'Seconds to wait before retrying with the same key.';

export const problemResponse = (description: string, retryAfter?: string): OpenApiResponse => ({
  description,
  ...(retryAfter === undefined
    ? {}
    : { headers: { [RETRY_AFTER_HEADER]: { description: retryAfter, schema: { type: 'integer' } } } }),
  content: { [PROBLEM_CONTENT_TYPE]: { schema: componentRef(PROBLEM_ID) } },
});

export const UNAUTHORIZED_RESPONSE = {
  [HTTP_STATUS.UNAUTHORIZED]: problemResponse('The API key is missing or unknown.'),
};

export const IDEMPOTENCY_RESPONSES = {
  [HTTP_STATUS.CONFLICT]: problemResponse(
    'A request with the same Idempotency-Key is still running, or the change conflicts with the current state. The detail names which.',
    RETRY_WITH_SAME_KEY,
  ),
  [HTTP_STATUS.UNPROCESSABLE_CONTENT]: problemResponse(
    'The Idempotency-Key was already used with a different request body.',
  ),
};

export const BAD_REQUEST_RESPONSE = {
  [HTTP_STATUS.BAD_REQUEST]: problemResponse(
    'The body failed validation, or the Idempotency-Key header is missing or not a UUID. The detail lists the fields.',
  ),
};

export const LIST_BAD_REQUEST_RESPONSE = {
  [HTTP_STATUS.BAD_REQUEST]: problemResponse(
    'A query parameter failed validation, or `startingAfter` is not an id from this list. The detail names which.',
  ),
};

export const NOT_FOUND_RESPONSE = {
  [HTTP_STATUS.NOT_FOUND]: problemResponse(
    'No such record in your application. A record of another application answers the same way.',
  ),
};
