import type { Database } from '@/lib/db';
import { generateSecret } from '@/lib/tenants/generate-secret';
import { hashApiKey } from '@/lib/tenants/hash-api-key';
import { tenantsTable, type Tenant } from '@/lib/tenants/schema';
import { TENANT_POLICY_DEFAULTS } from '@/lib/tenants/tenant-policy-defaults';

export type CreateTenantInput = {
  slug: string;
  webhookUrl: string;
  organizationId: Tenant['organizationId'];
  providerConnectionId: Tenant['providerConnectionId'];
};
export type CreatedTenant = { tenant: Tenant; apiKey: string };

export const createTenant = async (db: Database, input: CreateTenantInput): Promise<CreatedTenant> => {
  const apiKey = generateSecret();
  const [tenant] = await db
    .insert(tenantsTable)
    .values({
      ...input,
      ...TENANT_POLICY_DEFAULTS,
      dunningScheduleDays: [...TENANT_POLICY_DEFAULTS.dunningScheduleDays],
      apiKeyHash: hashApiKey(apiKey),
      webhookSecret: generateSecret(),
    })
    .returning();
  if (tenant === undefined) throw new Error('tenant insert returned no row');
  return { tenant, apiKey };
};
