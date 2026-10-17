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
import { subscriptionResultResponse } from '@/api/subscription-result-response';
import type { Clock } from '@/lib/clock';
import { findCustomer } from '@/lib/customers/find-customer';
import { cancelSubscription } from '@/lib/subscriptions/cancel-subscription';
import { COMMAND_RESULT } from '@/lib/subscriptions/command-result';
import { findSubscription } from '@/lib/subscriptions/find-subscription';
import { resumeSubscription } from '@/lib/subscriptions/resume-subscription';
import { updatePaymentMethodRequestSchema } from '@/contract/update-payment-method-request';
import type { UpdatePaymentMethodResponse } from '@/contract/update-payment-method-response';
import { START_CARD_UPDATE } from '@/lib/payment-method-updates/start-card-update-outcome';
import { startPaymentMethodUpdate } from '@/lib/payment-method-updates/start-payment-method-update';

const MISSING_CUSTOMER = 'subscription references a missing customer';
const subscriptionIdParam = zSubscriptionRead.shape.subscriptionId;
const ID = 'subscriptionId';

const createBody = z.object({
  customerId: zSubscriptionRead.shape.customerId,
  planId: zSubscriptionRead.shape.planId,
  returnUrl: createSubscriptionRequestSchema.shape.returnUrl,
});

export const subscriptionsRoutes = (providerFor: ProviderFor, clock: Clock) =>
  new Hono<AppEnv>()
    .post('/', async (c) => {
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
      const response: CreateSubscriptionResponse = {
        data: { subscriptionId, status, checkoutUrl: result.checkoutUrl },
      };
      return c.json(response, HTTP_STATUS.CREATED);
    })
    .get(`/:${ID}`, async (c) => {
      const id = subscriptionIdParam.safeParse(c.req.param(ID));
      if (!id.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const { tenantId } = c.get('tenant');
      const db = c.get('db');
      const subscription = await findSubscription(db, tenantId, id.data);
      if (subscription === undefined) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const customer = await findCustomer(db, tenantId, subscription.customerId);
      if (customer === undefined) throw new Error(MISSING_CUSTOMER);
      return subscriptionResultResponse(c, { kind: COMMAND_RESULT.DONE, subscription, customer });
    })
    .post(`/:${ID}/cancel`, async (c) => {
      const id = subscriptionIdParam.safeParse(c.req.param(ID));
      if (!id.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const input = { tenant: c.get('tenant'), subscriptionId: id.data, now: clock.now() };
      return subscriptionResultResponse(c, await cancelSubscription(c.get('db'), input));
    })
    .post(`/:${ID}/resume`, async (c) => {
      const id = subscriptionIdParam.safeParse(c.req.param(ID));
      if (!id.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const input = { tenant: c.get('tenant'), subscriptionId: id.data, now: clock.now() };
      return subscriptionResultResponse(c, await resumeSubscription(c.get('db'), input));
    })
    .post(`/:${ID}/update-payment-method`, async (c) => {
      const id = subscriptionIdParam.safeParse(c.req.param(ID));
      if (!id.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const body = updatePaymentMethodRequestSchema.safeParse(await readJsonBody(c));
      if (!body.success) return problemResponse(c, HTTP_STATUS.BAD_REQUEST, body.error.message);
      const result = await startPaymentMethodUpdate(
        { db: c.get('db'), providerFor },
        { tenant: c.get('tenant'), subscriptionId: id.data, returnUrl: body.data.returnUrl, now: clock.now() },
      );
      if (result.kind === START_CARD_UPDATE.NOT_FOUND) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      if (result.kind === START_CARD_UPDATE.REJECTED) return problemResponse(c, HTTP_STATUS.CONFLICT, result.reason);
      const response: UpdatePaymentMethodResponse = {
        data: { subscriptionId: id.data, checkoutUrl: result.checkoutUrl },
      };
      return c.json(response, HTTP_STATUS.CREATED);
    });
