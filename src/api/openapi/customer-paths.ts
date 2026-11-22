import { HTTP_STATUS } from '@/api/http-status';
import { API_TAG } from '@/api/openapi/api-tags';
import { jsonBody, jsonResponse } from '@/api/openapi/json-response';
import type { OpenApiPaths } from '@/api/openapi/openapi-types';
import {
  BAD_REQUEST_RESPONSE,
  IDEMPOTENCY_RESPONSES,
  NOT_FOUND_RESPONSE,
  problemResponse,
  UNAUTHORIZED_RESPONSE,
} from '@/api/openapi/problem-responses';
import { IDEMPOTENCY_KEY_PARAMETER, idPathParameter } from '@/api/openapi/request-parameters';
import { toOpenApiSchema } from '@/api/openapi/to-openapi-schema';
import { createCustomerRequestSchema } from '@/contract/create-customer-request';
import { customerResponseSchema } from '@/contract/customer-response';

const customerResponse = toOpenApiSchema(customerResponseSchema, 'output');

export const customerPaths: OpenApiPaths = {
  '/v1/customers': {
    post: {
      operationId: 'createCustomer',
      tags: [API_TAG.CUSTOMERS],
      summary: 'Create a customer',
      description:
        'Creates a customer for one of your users. `externalRef` is your own id for the user and must be unique within your application, so a second create with the same `externalRef` is refused with a 409.\n\nBilling details (`name`, `email`, `taxId`) are optional and go on tax invoices. They can only be set here, at creation.',
      parameters: [IDEMPOTENCY_KEY_PARAMETER],
      requestBody: jsonBody(toOpenApiSchema(createCustomerRequestSchema, 'input')),
      responses: {
        [HTTP_STATUS.CREATED]: jsonResponse('The new customer.', customerResponse),
        ...BAD_REQUEST_RESPONSE,
        ...UNAUTHORIZED_RESPONSE,
        ...IDEMPOTENCY_RESPONSES,
        [HTTP_STATUS.CONFLICT]: problemResponse(
          'A customer with this externalRef already exists, or a request with the same Idempotency-Key is still running.',
          'Seconds to wait before retrying with the same key. Sent only for a request still running.',
        ),
      },
    },
  },
  '/v1/customers/{customerId}': {
    get: {
      operationId: 'getCustomer',
      tags: [API_TAG.CUSTOMERS],
      summary: 'Retrieve a customer',
      description: 'Returns a customer by its id.',
      parameters: [idPathParameter('customerId', 'The customer to retrieve.')],
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('The customer.', customerResponse),
        ...UNAUTHORIZED_RESPONSE,
        ...NOT_FOUND_RESPONSE,
      },
    },
  },
};
