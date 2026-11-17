import { and, asc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { MAX_INVOICE_ATTEMPTS } from '@/lib/invoices/invoice-retry-schedule';
import { INVOICE_STATUS } from '@/lib/invoices/invoice-status';
import { INVOICE_BATCH_SIZE, INVOICE_LEASE_MS } from '@/lib/invoices/invoice-timing';
import { invoicesTable, type Invoice } from '@/lib/invoices/schema';

export const claimDueInvoices = async (db: Database, now: Date): Promise<Invoice[]> => {
  const due = db
    .select({ invoiceId: invoicesTable.invoiceId })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.status, INVOICE_STATUS.PENDING),
        lte(invoicesTable.nextAttemptAt, now),
        lt(invoicesTable.attempts, MAX_INVOICE_ATTEMPTS),
      ),
    )
    .orderBy(asc(invoicesTable.nextAttemptAt))
    .limit(INVOICE_BATCH_SIZE)
    .for('update', { skipLocked: true });

  return db
    .update(invoicesTable)
    .set({ attempts: sql`${invoicesTable.attempts} + 1`, nextAttemptAt: new Date(now.getTime() + INVOICE_LEASE_MS) })
    .where(inArray(invoicesTable.invoiceId, due))
    .returning();
};
