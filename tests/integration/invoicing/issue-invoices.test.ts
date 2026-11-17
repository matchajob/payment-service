import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { customersTable } from '@/lib/customers/schema';
import { INVOICE_STATUS } from '@/lib/invoices/invoice-status';
import { testDb, withRollback } from '@tests/utils/db';
import { BILLING_DETAILS, NO_BILLING_DETAILS } from '@tests/utils/customer-billing-fixtures';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { invoicesOf } from '@tests/utils/invoice-reads';
import { issueInvoicesWith } from '@tests/utils/invoice-run';
import { RUN_AT, seedInvoicedTenant } from '@tests/utils/invoicing-rows';

describe('issuing an invoice (ADR 0027)', () => {
  it("sends the charge's amount, currency, payment time and provider ref, the plan name, and our invoice id as the reference", async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { renewing, connection, charge } = await seedInvoicedTenant(tx);

      await issueInvoicesWith(tx, invoicers.invoicerFor)(RUN_AT);

      const [invoice] = await invoicesOf(tx, charge.chargeId);
      expect(invoicers.invoicerOf(connection.invoicingConnectionId).calls.issue).toEqual([
        {
          reference: invoice?.invoiceId,
          issuedAt: charge.attemptedAt,
          amountMinor: charge.amountMinor,
          currency: charge.currency,
          description: renewing.ctx.plan.name,
          customer: NO_BILLING_DETAILS,
          providerChargeRef: charge.providerChargeRef,
        },
      ]);
    });
  });

  it("puts the customer's billing details on the invoice", async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { renewing, connection } = await seedInvoicedTenant(tx);
      await tx
        .update(customersTable)
        .set(BILLING_DETAILS)
        .where(eq(customersTable.customerId, renewing.subscription.customerId));

      await issueInvoicesWith(tx, invoicers.invoicerFor)(RUN_AT);

      expect(invoicers.invoicerOf(connection.invoicingConnectionId).calls.issue).toEqual([
        expect.objectContaining({ customer: BILLING_DETAILS }),
      ]);
    });
  });

  it("records the issued invoice: its status, the service's ref and the document link", async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection, charge } = await seedInvoicedTenant(tx);

      await issueInvoicesWith(tx, invoicers.invoicerFor)(RUN_AT);

      const [issued] = invoicers.invoicerOf(connection.invoicingConnectionId).issued();
      expect(await invoicesOf(tx, charge.chargeId)).toEqual([
        expect.objectContaining({
          status: INVOICE_STATUS.ISSUED,
          invoiceRef: issued?.invoiceRef,
          documentUrl: issued?.documentUrl,
          issuedAt: RUN_AT,
          lastError: null,
        }),
      ]);
    });
  });
});
