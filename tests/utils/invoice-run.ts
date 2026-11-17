import type { Logger } from 'pino';
import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import { issueInvoices } from '@/lib/invoices/issue-invoices';
import type { InvoicerFor } from '@/lib/invoicing-connections/invoicer-for';
import { silentLogger } from '@tests/utils/silent-logger';
import { NEVER_TIME_UP } from '@tests/utils/time-up-fixtures';

export const issueInvoicesWith =
  (db: Database, invoicerFor: InvoicerFor, logger: Logger = silentLogger, timeUp: TimeUp = NEVER_TIME_UP) =>
  (now: Date) =>
    issueInvoices({ db, invoicerFor, logger, timeUp }, now);
