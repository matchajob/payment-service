import pino from 'pino';
import { readSeedArgs } from '@/cli/seed-args';
import { createDb } from '@/lib/db';
import { createPlan } from '@/lib/plans/create-plan';
import { createTenant } from '@/lib/tenants/create-tenant';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { selectCredentialCipher } from '@/lib/provider-connections/select-credential-cipher';
import { createOrganization } from '@/lib/organizations/create-organization';
import { createProviderConnection } from '@/lib/provider-connections/create-provider-connection';
import { buildProviderFrom } from '@/lib/provider-connections/build-provider';
import { readProviderConfig } from '@/lib/provider-connections/read-provider-config';

const ARGS_START = 2;

const args = readSeedArgs(process.argv.slice(ARGS_START));
const logger = pino();
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));
const cipher = selectCredentialCipher({
  kmsKeyName: process.env[ENV.PROVIDER_CREDENTIALS_KMS_KEY],
  localKey: process.env[ENV.PROVIDER_CREDENTIALS_LOCAL_KEY],
});

const seeded = await db.transaction(async (tx) => {
  const { organizationId } = await createOrganization(tx, args.organization);
  const { providerConnectionId } = await createProviderConnection(
    tx,
    { cipher, buildProvider: buildProviderFrom(readProviderConfig()) },
    { organizationId, ...args.connection },
  );
  const { tenant, apiKey } = await createTenant(tx, { ...args.tenant, organizationId, providerConnectionId });
  const plan = await createPlan(tx, { ...args.plan, tenantId: tenant.tenantId });
  return { organizationId, providerConnectionId, tenantId: tenant.tenantId, planId: plan.planId, apiKey };
});
logger.info(seeded, 'seeded; the API key is shown once');

await db.$client.end();
