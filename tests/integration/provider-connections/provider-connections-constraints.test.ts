import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { zProviderConnectionRead } from '@/lib/provider-connections/schema';
import { createTenant } from '@/lib/tenants/create-tenant';
import { tenantsTable } from '@/lib/tenants/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const SAME_ORGANIZATION = 'tenants_connection_same_organization';
const SEALED_COLUMN = 'sealedCredentials';

describe('organizations own provider connections (ADR 0010 decision 1)', () => {
  it("rejects a tenant pointing at another organization's connection, whatever the code above does", async () => {
    await withRollback(testDb(), async (tx) => {
      const ours = await seedConnection(tx);
      const theirs = await seedConnection(tx);
      const write = (db: Database) =>
        createTenant(db, {
          ...ACME,
          organizationId: ours.organizationId,
          providerConnectionId: theirs.providerConnectionId,
        });
      expect(await violatedConstraint(tx, write)).toBe(SAME_ORGANIZATION);
    });
  });

  it("rejects moving an existing tenant onto another organization's connection", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx, ACME);
      const theirs = await seedConnection(tx);
      const move = (db: Database) =>
        db
          .update(tenantsTable)
          .set({ providerConnectionId: theirs.providerConnectionId })
          .where(eq(tenantsTable.tenantId, tenant.tenantId));
      expect(await violatedConstraint(tx, move)).toBe(SAME_ORGANIZATION);
    });
  });

  it('lets two applications of one organization share one connection (ADR 0010 context 2)', async () => {
    await withRollback(testDb(), async (tx) => {
      const shared = await seedConnection(tx);
      await seedTenant(tx, ACME, shared);
      const second = (db: Database) => createTenant(db, { ...GLOBEX, ...shared });
      expect(await violatedConstraint(tx, second)).toBeUndefined();
    });
  });

  it('lets a tenant move to another connection of its own organization', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, organizationId } = await seedTenant(tx, ACME);
      const replacement = await seedConnection(tx, organizationId);
      const move = (db: Database) =>
        db
          .update(tenantsTable)
          .set({ providerConnectionId: replacement.providerConnectionId })
          .where(eq(tenantsTable.tenantId, tenant.tenantId));
      expect(await violatedConstraint(tx, move)).toBeUndefined();
    });
  });

  it('leaves the sealed credentials out of the read schema, so nothing built from it can carry them', () => {
    expect(Object.keys(zProviderConnectionRead.shape)).not.toContain(SEALED_COLUMN);
    expect(Object.keys(zProviderConnectionRead.shape)).toContain('providerConnectionId');
  });
});
