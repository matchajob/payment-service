import type { ClientOptions } from '@sdk/client-options';
import { customersResource } from '@sdk/customers';
import { plansResource } from '@sdk/plans';
import { createRequester } from '@sdk/request';
import { subscriptionsResource } from '@sdk/subscriptions';

export const createClient = (options: ClientOptions) => {
  const request = createRequester(options);
  return {
    plans: plansResource(request),
    customers: customersResource(request),
    subscriptions: subscriptionsResource(request),
  };
};

export type PaymentServiceClient = ReturnType<typeof createClient>;
