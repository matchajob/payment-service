import type { ClientOptions } from '@sdk/client-options';
import { chargesResource } from '@sdk/charges';
import { customersResource } from '@sdk/customers';
import { eventsResource } from '@sdk/events';
import { plansResource } from '@sdk/plans';
import { createRequester } from '@sdk/request';
import { subscriptionsResource } from '@sdk/subscriptions';

export const createClient = (options: ClientOptions) => {
  const request = createRequester(options);
  return {
    plans: plansResource(request),
    customers: customersResource(request),
    subscriptions: subscriptionsResource(request),
    charges: chargesResource(request),
    events: eventsResource(request),
  };
};

export type PaymentServiceClient = ReturnType<typeof createClient>;
