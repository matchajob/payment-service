import type { Database } from '@/lib/db';
import { createTenant, type CreatedTenant } from '@/lib/tenants/create-tenant';
import { seedConnection, type SeededConnection } from '@tests/utils/connection-rows';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';

export type SeededTenant = CreatedTenant & SeededConnection;

export const seedTenant = async (
  db: Database,
  fixture: TenantFixture = ACME,
  connection?: SeededConnection,
): Promise<SeededTenant> => {
  const { organizationId, providerConnectionId } = connection ?? (await seedConnection(db));
  const created = await createTenant(db, { ...fixture, organizationId, providerConnectionId });
  return { ...created, organizationId, providerConnectionId };
};
