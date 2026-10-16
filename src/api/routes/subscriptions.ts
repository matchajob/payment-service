import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { readJsonBody } from '@/api/read-json-body';
import { createSubscriptionRequestSchema } from '@/contract/create-subscription-request';
import type { CreateSubscriptionResponse } from '@/contract/create-subscription-response';
import { createSubscription } from '@/lib/subscriptions/create-subscription';
import { CREATE_SUBSCRIPTION_OUTCOME } from '@/lib/subscriptions/create-subscription-outcome';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';

const createBody = z.object({
  customerId: zSubscriptionRead.shape.customerId,
  planId: zSubscriptionRead.shape.planId,
  returnUrl: createSubscriptionRequestSchema.shape.returnUrl,
});

export const subscriptionsRoutes = (providerFor: ProviderFor) =>
  new Hono<AppEnv>().post('/', async (c) => {
    const body = createBody.safeParse(await readJsonBody(c));
    if (!body.success) return problemResponse(c, HTTP_STATUS.BAD_REQUEST, body.error.message);
    const result = await createSubscription(
      { db: c.get('db'), providerFor },
      { tenant: c.get('tenant'), ...body.data },
    );
    if (result.outcome === CREATE_SUBSCRIPTION_OUTCOME.CUSTOMER_NOT_FOUND) {
      return problemResponse(c, HTTP_STATUS.NOT_FOUND, `customer ${body.data.customerId} not found`);
    }
    if (result.outcome === CREATE_SUBSCRIPTION_OUTCOME.PLAN_NOT_FOUND) {
      return problemResponse(c, HTTP_STATUS.NOT_FOUND, `plan ${body.data.planId} not found`);
    }
    const { subscriptionId, status } = result.subscription;
    const response: CreateSubscriptionResponse = { data: { subscriptionId, status, checkoutUrl: result.checkoutUrl } };
    return c.json(response, HTTP_STATUS.CREATED);
  });
