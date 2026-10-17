import type { Subscription } from '@/lib/subscriptions/schema';
import { SUBSCRIPTIONS_PATH } from '@tests/utils/paths';
import { postJson } from '@tests/utils/post-json';

type SubscriptionId = Subscription['subscriptionId'];

const NO_BODY = {};

export const subscriptionPath = (subscriptionId: string) => `${SUBSCRIPTIONS_PATH}/${subscriptionId}`;
export const cancelPath = (subscriptionId: SubscriptionId) => `${subscriptionPath(subscriptionId)}/cancel`;
export const updatePaymentMethodPath = (subscriptionId: string) =>
  `${subscriptionPath(subscriptionId)}/update-payment-method`;
export const resumePath = (subscriptionId: SubscriptionId) => `${subscriptionPath(subscriptionId)}/resume`;

export const postNoBody = (apiKey: string, idempotencyKey?: string): RequestInit =>
  postJson(apiKey, NO_BODY, idempotencyKey);
