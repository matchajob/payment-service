import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { listPlans } from '@/lib/plans/list-plans';
import type { PlanListResponse } from '@/contract/plan-list-response';

export const plansRoutes = () =>
  new Hono<AppEnv>().get('/', async (c) => {
    const plans = await listPlans(c.get('db'), c.get('tenant').tenantId);
    const body: PlanListResponse = {
      data: plans.map(({ planId, name, amountMinor, currency, interval }) => ({
        planId,
        name,
        amountMinor,
        currency,
        interval,
      })),
    };
    return c.json(body);
  });
