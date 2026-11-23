import { HTTP_STATUS } from '@/api/http-status';
import { API_TAG } from '@/api/openapi/api-tags';
import { jsonResponse } from '@/api/openapi/json-response';
import type { OpenApiPaths } from '@/api/openapi/openapi-types';
import { LIST_BAD_REQUEST_RESPONSE, UNAUTHORIZED_RESPONSE } from '@/api/openapi/problem-responses';
import { queryParameters } from '@/api/openapi/query-parameters';
import { toOpenApiSchema } from '@/api/openapi/to-openapi-schema';
import { chargeListQuerySchema } from '@/contract/charge-list-query';
import { chargeListResponseSchema } from '@/contract/charge-list-response';

export const chargePaths: OpenApiPaths = {
  '/v1/charges': {
    get: {
      operationId: 'listCharges',
      tags: [API_TAG.CHARGES],
      summary: 'List charges',
      description:
        "Returns your charges, newest first. Filter by `status`: `failed` with the provider's `failureReason` is what your support team needs. Page with `limit` and `startingAfter`.",
      parameters: queryParameters(chargeListQuerySchema),
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('A page of your charges.', toOpenApiSchema(chargeListResponseSchema, 'output')),
        ...LIST_BAD_REQUEST_RESPONSE,
        ...UNAUTHORIZED_RESPONSE,
      },
    },
  },
};
