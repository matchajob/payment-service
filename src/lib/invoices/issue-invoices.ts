import type { Logger } from 'pino';
import type { CronSummary } from '@/lib/cron/cron-summary';
import { forEachWithinBudget } from '@/lib/cron/for-each-within-budget';
import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import { claimDueInvoices } from '@/lib/invoices/claim-due-invoices';
import { issueOneInvoice } from '@/lib/invoices/issue-one-invoice';
import { queueInvoices } from '@/lib/invoices/queue-invoices';
import type { InvoicerFor } from '@/lib/invoicing-connections/invoicer-for';

export type IssueInvoicesDeps = {
  db: Database;
  invoicerFor: InvoicerFor;
  logger: Pick<Logger, 'error' | 'warn'>;
  timeUp: TimeUp;
};

const NOTHING_DONE: CronSummary = { processed: 0, failed: 0 };

export const issueInvoices = async (
  { db, invoicerFor, logger, timeUp }: IssueInvoicesDeps,
  now: Date,
): Promise<CronSummary> => {
  await queueInvoices(db, now);
  if (timeUp()) return NOTHING_DONE;
  const claimed = await claimDueInvoices(db, now);
  const results: boolean[] = [];
  await forEachWithinBudget({ timeUp, logger }, claimed, async (invoice) => {
    results.push(await issueOneInvoice({ db, invoicerFor, logger }, invoice, now));
  });
  const issued = results.filter(Boolean).length;
  return { processed: issued, failed: results.length - issued };
};
