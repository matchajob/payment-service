import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import type { Database } from '@/lib/db';
import { listPlans } from '@/lib/plans/list-plans';

export const plansRoutes = (db: Database) =>
  new Hono<AppEnv>().get('/', async (c) => {
    const plans = await listPlans(db, c.get('tenant').tenantId);
    return c.json({
      data: plans.map(({ planId, name, amountMinor, currency, interval }) => ({
        planId,
        name,
        amountMinor,
        currency,
        interval,
      })),
    });
  });
