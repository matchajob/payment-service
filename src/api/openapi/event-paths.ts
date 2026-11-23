import { HTTP_STATUS } from '@/api/http-status';
import { API_TAG } from '@/api/openapi/api-tags';
import { jsonResponse } from '@/api/openapi/json-response';
import type { OpenApiPaths } from '@/api/openapi/openapi-types';
import {
  IDEMPOTENCY_RESPONSES,
  LIST_BAD_REQUEST_RESPONSE,
  NOT_FOUND_RESPONSE,
  problemResponse,
  RETRY_WITH_SAME_KEY,
  UNAUTHORIZED_RESPONSE,
} from '@/api/openapi/problem-responses';
import { queryParameters } from '@/api/openapi/query-parameters';
import { IDEMPOTENCY_KEY_PARAMETER, idPathParameter } from '@/api/openapi/request-parameters';
import { toOpenApiSchema } from '@/api/openapi/to-openapi-schema';
import { eventListQuerySchema } from '@/contract/event-list-query';
import { eventListResponseSchema } from '@/contract/event-list-response';
import { eventResponseSchema } from '@/contract/event-response';

export const eventPaths: OpenApiPaths = {
  '/v1/events': {
    get: {
      operationId: 'listEvents',
      tags: [API_TAG.EVENTS],
      summary: 'List events',
      description:
        'Returns the events sent to your webhook URL, newest first, with their delivery state. Filter by `deliveryStatus`: `dead` lists the events your endpoint never accepted. Page with `limit` and `startingAfter`.',
      parameters: queryParameters(eventListQuerySchema),
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('A page of your events.', toOpenApiSchema(eventListResponseSchema, 'output')),
        ...LIST_BAD_REQUEST_RESPONSE,
        ...UNAUTHORIZED_RESPONSE,
      },
    },
  },
  '/v1/events/{eventId}/redrive': {
    post: {
      operationId: 'redriveEvent',
      tags: [API_TAG.EVENTS],
      summary: 'Redrive a dead event',
      description:
        'Queues a `dead` event for delivery again, now, with a fresh attempt count. It keeps its eventId and sequence, so your handler deduplicates it as usual.',
      parameters: [idPathParameter('eventId', 'The dead event to deliver again.'), IDEMPOTENCY_KEY_PARAMETER],
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('The event, queued again.', toOpenApiSchema(eventResponseSchema, 'output')),
        ...UNAUTHORIZED_RESPONSE,
        ...NOT_FOUND_RESPONSE,
        ...IDEMPOTENCY_RESPONSES,
        [HTTP_STATUS.CONFLICT]: problemResponse(
          'The event is not dead: it is still being retried or was delivered. A request with the same Idempotency-Key still running also answers 409.',
          RETRY_WITH_SAME_KEY,
        ),
      },
    },
  },
};
