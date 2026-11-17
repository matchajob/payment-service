import type { Logger } from 'pino';
import type { Database } from '@/lib/db';
import { findInvoiceParts } from '@/lib/invoices/find-invoice-parts';
import { FIRST_INVOICE_ATTEMPT } from '@/lib/invoices/invoice-attempts';
import { recordInvoiceFailure, recordInvoiceIssued } from '@/lib/invoices/record-invoice-result';
import type { Invoice } from '@/lib/invoices/schema';
import type { InvoicerFor } from '@/lib/invoicing-connections/invoicer-for';

export const INVOICE_FAILED_FOR_GOOD = 'invoice could not be issued after every attempt; issue it by hand';

export type IssueOneInvoiceDeps = { db: Database; invoicerFor: InvoicerFor; logger: Pick<Logger, 'error'> };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const issueOneInvoice = async (
  { db, invoicerFor, logger }: IssueOneInvoiceDeps,
  invoice: Invoice,
  now: Date,
): Promise<boolean> => {
  try {
    const { request, connection } = await findInvoiceParts(db, invoice);
    const invoicer = await invoicerFor(connection);
    // A retry may follow an attempt whose answer was lost, so it asks before issuing a second invoice.
    const alreadyIssued =
      invoice.attempts > FIRST_INVOICE_ATTEMPT ? await invoicer.findIssued(invoice.invoiceId) : undefined;
    await recordInvoiceIssued(db, invoice, alreadyIssued ?? (await invoicer.issue(request)), now);
    return true;
  } catch (error) {
    const dead = await recordInvoiceFailure(db, invoice, messageOf(error), now);
    if (dead)
      logger.error({ err: error, invoiceId: invoice.invoiceId, chargeId: invoice.chargeId }, INVOICE_FAILED_FOR_GOOD);
    return false;
  }
};
