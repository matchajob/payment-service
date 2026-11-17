import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { invoiceRetryDelayAfter } from '@/lib/invoices/invoice-retry-schedule';
import { INVOICE_STATUS } from '@/lib/invoices/invoice-status';
import { invoicesTable, type Invoice } from '@/lib/invoices/schema';
import type { IssuedInvoice } from '@/lib/invoicing/invoicer';
import { toLastError } from '@/lib/outbox/last-error';

type Claimed = Pick<Invoice, 'invoiceId' | 'attempts'>;

const stillOurs = ({ invoiceId, attempts }: Claimed) =>
  and(
    eq(invoicesTable.invoiceId, invoiceId),
    eq(invoicesTable.attempts, attempts),
    eq(invoicesTable.status, INVOICE_STATUS.PENDING),
  );

export const recordInvoiceIssued = async (
  db: Database,
  claimed: Claimed,
  { invoiceRef, documentUrl }: IssuedInvoice,
  now: Date,
): Promise<void> => {
  await db
    .update(invoicesTable)
    .set({ status: INVOICE_STATUS.ISSUED, invoiceRef, documentUrl, issuedAt: now, lastError: null })
    .where(stillOurs(claimed));
};

export const recordInvoiceFailure = async (
  db: Database,
  claimed: Claimed,
  error: string,
  now: Date,
): Promise<boolean> => {
  const lastError = toLastError(error);
  const delay = invoiceRetryDelayAfter(claimed.attempts);
  const [written] = await db
    .update(invoicesTable)
    .set(
      delay === undefined
        ? { status: INVOICE_STATUS.DEAD, lastError }
        : { lastError, nextAttemptAt: new Date(now.getTime() + delay) },
    )
    .where(stillOurs(claimed))
    .returning({ status: invoicesTable.status });
  return written?.status === INVOICE_STATUS.DEAD;
};
