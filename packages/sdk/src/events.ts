import type { z } from 'zod';
import type { eventListQuerySchema } from '@/contract/event-list-query';
import { eventListResponseSchema } from '@/contract/event-list-response';
import { eventResponseSchema } from '@/contract/event-response';
import { API_PATH, pathWithId } from '@sdk/api-path';
import type { CallOptions } from '@sdk/client-options';
import { HTTP_METHOD } from '@sdk/http-method';
import { withQueryString } from '@sdk/query-string';
import type { Requester } from '@sdk/request';

const REDRIVE = 'redrive';

export type EventListQuery = Partial<z.output<typeof eventListQuerySchema>>;

export const eventsResource = (request: Requester) => ({
  list: (query: EventListQuery = {}) =>
    request({
      method: HTTP_METHOD.GET,
      path: withQueryString(API_PATH.EVENTS, query),
      response: eventListResponseSchema,
    }),
  redrive: async (eventId: string, options: CallOptions = {}) =>
    (
      await request({
        method: HTTP_METHOD.POST,
        path: pathWithId(API_PATH.EVENTS, eventId, REDRIVE),
        idempotencyKey: options.idempotencyKey,
        response: eventResponseSchema,
      })
    ).data,
});
