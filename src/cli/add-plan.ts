import pino from 'pino';
import { readAddPlanArgs } from '@/cli/add-plan-args';
import { createDb } from '@/lib/db';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { ADD_PLAN } from '@/lib/plans/add-plan-outcome';
import { addPlanToTenant } from '@/lib/plans/add-plan-to-tenant';

const ARGS_START = 2;
const NOT_ADDED_EXIT_CODE = 1;

const args = readAddPlanArgs(process.argv.slice(ARGS_START));
const logger = pino();
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));

const added = await addPlanToTenant(db, args);
if (added.outcome === ADD_PLAN.ADDED)
  logger.info({ tenantSlug: args.tenantSlug, planId: added.plan.planId }, 'plan added');
else {
  logger.error({ tenantSlug: args.tenantSlug }, 'no tenant has this slug; nothing added');
  process.exitCode = NOT_ADDED_EXIT_CODE;
}

await db.$client.end();
