import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { tenantsTable } from '@/lib/tenants/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { seedInvoicingConnection } from '@tests/utils/invoicing-connection-rows';
import { GLOBEX } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const SAME_ORGANIZATION = 'tenants_invoicing_connection_same_organization';

describe("a tenant's invoicing connection (ADR 0027)", () => {
  it('has none by default, so no invoice is issued until the tenant connects one', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx);
      expect(tenant.invoicingConnectionId).toBeNull();
    });
  });

  it("points at an invoicing connection of the tenant's own organization", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, organizationId } = await seedTenant(tx);
      const connection = await seedInvoicingConnection(tx, organizationId);
      const [updated] = await tx
        .update(tenantsTable)
        .set({ invoicingConnectionId: connection.invoicingConnectionId })
        .where(eq(tenantsTable.tenantId, tenant.tenantId))
        .returning();
      expect(updated?.invoicingConnectionId).toBe(connection.invoicingConnectionId);
    });
  });

  it("refuses another organization's invoicing connection, so invoices never go out in someone else's name", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx);
      const other = await seedTenant(tx, GLOBEX);
      const othersConnection = await seedInvoicingConnection(tx, other.organizationId);
      expect(
        await violatedConstraint(tx, (savepoint) =>
          savepoint
            .update(tenantsTable)
            .set({ invoicingConnectionId: othersConnection.invoicingConnectionId })
            .where(eq(tenantsTable.tenantId, tenant.tenantId)),
        ),
      ).toBe(SAME_ORGANIZATION);
    });
  });
});
