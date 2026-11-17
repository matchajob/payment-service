import { describe, expect, it } from 'vitest';
import { MAX_INVOICE_ATTEMPTS, invoiceRetryDelayAfter } from '@/lib/invoices/invoice-retry-schedule';
import { INVOICE_FAILED_FOR_GOOD } from '@/lib/invoices/issue-one-invoice';
import { FIRST_INVOICE_ATTEMPT } from '@/lib/invoices/invoice-attempts';
import { INVOICE_STATUS } from '@/lib/invoices/invoice-status';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { invoicesOf } from '@tests/utils/invoice-reads';
import { issueInvoicesWith } from '@tests/utils/invoice-run';
import { RUN_AT, seedInvoicedTenant } from '@tests/utils/invoicing-rows';
import { PINO_LEVEL } from '@tests/utils/pino-levels';
import { ALWAYS_TIME_UP } from '@tests/utils/time-up-fixtures';
import { silentLogger } from '@tests/utils/silent-logger';

const ONE_MS = 1;
const ONE_FAILED = { processed: 0, failed: 1 };
const ONE_ISSUED = { processed: 1, failed: 0 };
const NOTHING_DONE = { processed: 0, failed: 0 };
const at = (ms: number) => new Date(RUN_AT.getTime() + ms);

describe('issuing an invoice again after a failure (ADR 0027)', () => {
  it('keeps a failed invoice pending with its error and retries it after the delay, not before', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection, charge } = await seedInvoicedTenant(tx);
      const invoicer = invoicers.invoicerOf(connection.invoicingConnectionId);
      invoicer.failNextIssue();
      const issue = issueInvoicesWith(tx, invoicers.invoicerFor);
      const retryAt = at(invoiceRetryDelayAfter(FIRST_INVOICE_ATTEMPT) ?? 0);

      expect(await issue(RUN_AT)).toEqual(ONE_FAILED);
      expect(await invoicesOf(tx, charge.chargeId)).toEqual([
        expect.objectContaining({ status: INVOICE_STATUS.PENDING, attempts: 1, lastError: expect.any(String) }),
      ]);
      expect(await issue(new Date(retryAt.getTime() - ONE_MS))).toEqual(NOTHING_DONE);
      expect(await issue(retryAt)).toEqual(ONE_ISSUED);
      expect(invoicer.issued()).toHaveLength(1);
    });
  });

  it('never issues twice when the answer was lost: the next attempt finds the invoice the service already made', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection, charge } = await seedInvoicedTenant(tx);
      const invoicer = invoicers.invoicerOf(connection.invoicingConnectionId);
      invoicer.loseNextResponse();
      const issue = issueInvoicesWith(tx, invoicers.invoicerFor);

      await issue(RUN_AT);
      await issue(at(invoiceRetryDelayAfter(FIRST_INVOICE_ATTEMPT) ?? 0));

      expect(invoicer.calls.issue).toHaveLength(1);
      expect(invoicer.issued()).toHaveLength(1);
      expect(await invoicesOf(tx, charge.chargeId)).toEqual([
        expect.objectContaining({ status: INVOICE_STATUS.ISSUED, invoiceRef: invoicer.issued()[0]?.invoiceRef }),
      ]);
    });
  });

  it('gives up after the last attempt and logs an error naming the charge, so a person issues it by hand', async () => {
    await withRollback(testDb(), async (tx) => {
      const log = capturingLogger();
      const invoicers = fakeInvoicerFactory();
      const { connection, charge } = await seedInvoicedTenant(tx);
      const invoicer = invoicers.invoicerOf(connection.invoicingConnectionId);
      Array.from({ length: MAX_INVOICE_ATTEMPTS }).forEach(() => invoicer.failNextIssue());
      const attemptTimes = Array.from({ length: MAX_INVOICE_ATTEMPTS }, (_, index) =>
        Array.from(
          { length: index },
          (__, failed) => invoiceRetryDelayAfter(failed + FIRST_INVOICE_ATTEMPT) ?? 0,
        ).reduce((sum, delay) => sum + delay, RUN_AT.getTime()),
      );

      for (const time of attemptTimes) await issueInvoicesWith(tx, invoicers.invoicerFor, log.logger)(new Date(time));

      expect(await invoicesOf(tx, charge.chargeId)).toEqual([
        expect.objectContaining({ status: INVOICE_STATUS.DEAD, attempts: MAX_INVOICE_ATTEMPTS }),
      ]);
      expect(log.lines().filter(({ msg }) => msg === INVOICE_FAILED_FOR_GOOD)).toEqual([
        expect.objectContaining({ level: PINO_LEVEL.ERROR, chargeId: charge.chargeId }),
      ]);
    });
  });

  it('starts no invoice once the time budget is spent, and issues it on the next run', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      await seedInvoicedTenant(tx);

      expect(await issueInvoicesWith(tx, invoicers.invoicerFor, silentLogger, ALWAYS_TIME_UP)(RUN_AT)).toEqual(
        NOTHING_DONE,
      );
      expect(await issueInvoicesWith(tx, invoicers.invoicerFor)(RUN_AT)).toEqual(ONE_ISSUED);
    });
  });
});
