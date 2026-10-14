import pino from 'pino';
import { readSeedArgs } from '@/cli/seed-args';
import { createDb } from '@/lib/db';
import { createPlan } from '@/lib/plans/create-plan';
import { readDatabaseUrl } from '@/lib/read-database-url';
import { createTenant } from '@/lib/tenants/create-tenant';

const ARGS_START = 2;

const args = readSeedArgs(process.argv.slice(ARGS_START));
const logger = pino();
const db = createDb(readDatabaseUrl());

const { tenant, apiKey } = await createTenant(db, args.tenant);
const plan = await createPlan(db, { ...args.plan, tenantId: tenant.tenantId });
logger.info({ tenantId: tenant.tenantId, planId: plan.planId, apiKey }, 'seeded; the API key is shown once');

await db.$client.end();
