import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { tenantsTable } from '@/lib/tenants/schema';
import { seedInvoicingConnection } from '@tests/utils/invoicing-connection-rows';
import { ACTIVATED_AT, seedRenewing, type Renewing } from '@tests/utils/renewal-rows';
import { HOUR_MS } from '@tests/utils/reconcile-times';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';

export const CONNECTED_AT = new Date(ACTIVATED_AT.getTime() - HOUR_MS);
export const RUN_AT = new Date(ACTIVATED_AT.getTime() + HOUR_MS);

export const connectInvoicing = async (db: Database, renewing: Renewing, connectedAt: Date = CONNECTED_AT) => {
  const connection = await seedInvoicingConnection(db, renewing.ctx.organizationId, connectedAt);
  await db
    .update(tenantsTable)
    .set({ invoicingConnectionId: connection.invoicingConnectionId })
    .where(eq(tenantsTable.tenantId, renewing.ctx.tenantId));
  return connection;
};

export const seedInvoicedTenant = async (db: Database, tenant: TenantFixture = ACME) => {
  const renewing = await seedRenewing(db, {}, tenant);
  const connection = await connectInvoicing(db, renewing);
  const [charge] = renewing.history;
  if (charge === undefined) throw new Error('renewing subscription has no paid first charge');
  return { renewing, connection, charge };
};
