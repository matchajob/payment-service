import { createCustomerRequestSchema, type CreateCustomerRequest } from '@/contract/create-customer-request';
import { customerResponseSchema } from '@/contract/customer-response';
import { API_PATH, pathWithId } from '@sdk/api-path';
import type { CallOptions } from '@sdk/client-options';
import { HTTP_METHOD } from '@sdk/http-method';
import type { Requester } from '@sdk/request';

export const customersResource = (request: Requester) => ({
  create: async (input: CreateCustomerRequest, options: CallOptions = {}) =>
    (
      await request({
        method: HTTP_METHOD.POST,
        path: API_PATH.CUSTOMERS,
        body: createCustomerRequestSchema.parse(input),
        idempotencyKey: options.idempotencyKey,
        response: customerResponseSchema,
      })
    ).data,
  get: async (customerId: string) =>
    (
      await request({
        method: HTTP_METHOD.GET,
        path: pathWithId(API_PATH.CUSTOMERS, customerId),
        response: customerResponseSchema,
      })
    ).data,
});
