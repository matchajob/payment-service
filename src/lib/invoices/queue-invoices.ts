import { and, eq, gte, isNull } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { INVOICE_STATUS } from '@/lib/invoices/invoice-status';
import { NO_INVOICE_ATTEMPTS } from '@/lib/invoices/invoice-attempts';
import { INVOICE_QUEUE_BATCH_SIZE } from '@/lib/invoices/invoice-timing';
import { invoicesTable } from '@/lib/invoices/schema';
import { invoicingConnectionsTable } from '@/lib/invoicing-connections/schema';
import { tenantsTable } from '@/lib/tenants/schema';

export const queueInvoices = async (db: Database, now: Date): Promise<void> => {
  const uninvoiced = await db
    .select({
      chargeId: chargesTable.chargeId,
      invoicingConnectionId: invoicingConnectionsTable.invoicingConnectionId,
    })
    .from(chargesTable)
    .innerJoin(tenantsTable, eq(tenantsTable.tenantId, chargesTable.tenantId))
    .innerJoin(
      invoicingConnectionsTable,
      eq(invoicingConnectionsTable.invoicingConnectionId, tenantsTable.invoicingConnectionId),
    )
    .leftJoin(invoicesTable, eq(invoicesTable.chargeId, chargesTable.chargeId))
    .where(
      and(
        eq(chargesTable.status, CHARGE_STATUS.SUCCEEDED),
        gte(chargesTable.attemptedAt, invoicingConnectionsTable.createdAt),
        isNull(invoicesTable.invoiceId),
      ),
    )
    .limit(INVOICE_QUEUE_BATCH_SIZE);
  if (uninvoiced.length === 0) return;
  await db
    .insert(invoicesTable)
    .values(
      uninvoiced.map((charge) => ({
        ...charge,
        status: INVOICE_STATUS.PENDING,
        attempts: NO_INVOICE_ATTEMPTS,
        nextAttemptAt: now,
      })),
    )
    .onConflictDoNothing({ target: invoicesTable.chargeId });
};
