import type { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';
import type { BillingContext } from '@tests/utils/billing-context';
import { SUBSCRIPTIONS_PATH } from '@tests/utils/paths';
import { postJson } from '@tests/utils/post-json';

const RETURN_URL = 'https://tenant.test/billing/return';

export const startTestCheckout = async (app: Hono<AppEnv>, { apiKey, customerId, plan }: BillingContext) => {
  const res = await app.request(
    SUBSCRIPTIONS_PATH,
    postJson(apiKey, { customerId, planId: plan.planId, returnUrl: RETURN_URL }),
  );
  const body: { data: { subscriptionId: string } } = await res.json();
  return zSubscriptionRead.shape.subscriptionId.parse(body.data.subscriptionId);
};
