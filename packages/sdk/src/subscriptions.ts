import {
  createSubscriptionRequestSchema,
  type CreateSubscriptionRequest,
} from '@/contract/create-subscription-request';
import { createSubscriptionResponseSchema } from '@/contract/create-subscription-response';
import { subscriptionResponseSchema } from '@/contract/subscription-response';
import {
  updatePaymentMethodRequestSchema,
  type UpdatePaymentMethodRequest,
} from '@/contract/update-payment-method-request';
import { updatePaymentMethodResponseSchema } from '@/contract/update-payment-method-response';
import { API_PATH, pathWithId } from '@sdk/api-path';
import type { CallOptions } from '@sdk/client-options';
import { HTTP_METHOD } from '@sdk/http-method';
import type { Requester } from '@sdk/request';
import { SUBSCRIPTION_ACTION } from '@sdk/subscription-action';

export const subscriptionsResource = (request: Requester) => {
  const command = async (subscriptionId: string, action: string, options: CallOptions) =>
    (
      await request({
        method: HTTP_METHOD.POST,
        path: pathWithId(API_PATH.SUBSCRIPTIONS, subscriptionId, action),
        idempotencyKey: options.idempotencyKey,
        response: subscriptionResponseSchema,
      })
    ).data;

  return {
    create: async (input: CreateSubscriptionRequest, options: CallOptions = {}) =>
      (
        await request({
          method: HTTP_METHOD.POST,
          path: API_PATH.SUBSCRIPTIONS,
          body: createSubscriptionRequestSchema.parse(input),
          idempotencyKey: options.idempotencyKey,
          response: createSubscriptionResponseSchema,
        })
      ).data,
    get: async (subscriptionId: string) =>
      (
        await request({
          method: HTTP_METHOD.GET,
          path: pathWithId(API_PATH.SUBSCRIPTIONS, subscriptionId),
          response: subscriptionResponseSchema,
        })
      ).data,
    cancel: (subscriptionId: string, options: CallOptions = {}) =>
      command(subscriptionId, SUBSCRIPTION_ACTION.CANCEL, options),
    resume: (subscriptionId: string, options: CallOptions = {}) =>
      command(subscriptionId, SUBSCRIPTION_ACTION.RESUME, options),
    updatePaymentMethod: async (subscriptionId: string, input: UpdatePaymentMethodRequest, options: CallOptions = {}) =>
      (
        await request({
          method: HTTP_METHOD.POST,
          path: pathWithId(API_PATH.SUBSCRIPTIONS, subscriptionId, SUBSCRIPTION_ACTION.UPDATE_PAYMENT_METHOD),
          body: updatePaymentMethodRequestSchema.parse(input),
          idempotencyKey: options.idempotencyKey,
          response: updatePaymentMethodResponseSchema,
        })
      ).data,
  };
};
