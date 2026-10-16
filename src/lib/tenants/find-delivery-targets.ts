import { inArray } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { tenantsTable, type Tenant } from '@/lib/tenants/schema';

export type DeliveryTarget = Pick<Tenant, 'tenantId' | 'webhookUrl' | 'webhookSecret'>;

export const findDeliveryTargets = async (
  db: Database,
  tenantIds: Tenant['tenantId'][],
): Promise<Map<Tenant['tenantId'], DeliveryTarget>> => {
  const rows = await db
    .select({
      tenantId: tenantsTable.tenantId,
      webhookUrl: tenantsTable.webhookUrl,
      webhookSecret: tenantsTable.webhookSecret,
    })
    .from(tenantsTable)
    .where(inArray(tenantsTable.tenantId, [...new Set(tenantIds)]));
  return new Map(rows.map((row) => [row.tenantId, row]));
};
