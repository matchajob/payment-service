import { HTTP_STATUS } from '@/api/http-status';
import { jsonResponse } from '@/api/openapi/json-response';
import type { OpenApiPaths } from '@/api/openapi/openapi-types';
import { UNAUTHORIZED_RESPONSE } from '@/api/openapi/problem-responses';
import { API_TAG } from '@/api/openapi/api-tags';
import { toOpenApiSchema } from '@/api/openapi/to-openapi-schema';
import { planListResponseSchema } from '@/contract/plan-list-response';

export const planPaths: OpenApiPaths = {
  '/v1/plans': {
    get: {
      operationId: 'listPlans',
      tags: [API_TAG.PLANS],
      summary: 'List plans',
      description:
        'Returns every plan of your application. Plans are created with you at onboarding. Use a `planId` from this list to create a subscription.',
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('Your plans.', toOpenApiSchema(planListResponseSchema, 'output')),
        ...UNAUTHORIZED_RESPONSE,
      },
    },
  },
};
