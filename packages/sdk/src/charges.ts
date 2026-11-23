import type { z } from 'zod';
import type { chargeListQuerySchema } from '@/contract/charge-list-query';
import { chargeListResponseSchema } from '@/contract/charge-list-response';
import { API_PATH } from '@sdk/api-path';
import { HTTP_METHOD } from '@sdk/http-method';
import { withQueryString } from '@sdk/query-string';
import type { Requester } from '@sdk/request';

export type ChargeListQuery = Partial<z.output<typeof chargeListQuerySchema>>;

export const chargesResource = (request: Requester) => ({
  list: (query: ChargeListQuery = {}) =>
    request({
      method: HTTP_METHOD.GET,
      path: withQueryString(API_PATH.CHARGES, query),
      response: chargeListResponseSchema,
    }),
});
