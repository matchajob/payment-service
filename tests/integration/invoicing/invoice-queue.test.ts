import { describe, expect, it } from 'vitest';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { invoicesOf } from '@tests/utils/invoice-reads';
import { issueInvoicesWith } from '@tests/utils/invoice-run';
import { connectInvoicing, RUN_AT, seedInvoicedTenant } from '@tests/utils/invoicing-rows';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { HOUR_MS } from '@tests/utils/reconcile-times';
import { ACTIVATED_AT, seedRenewing } from '@tests/utils/renewal-rows';

const NOTHING_DONE = { processed: 0, failed: 0 };
const ONE_ISSUED = { processed: 1, failed: 0 };
const AFTER_ACTIVATION = new Date(ACTIVATED_AT.getTime() + HOUR_MS);
const LATER_RUN = new Date(RUN_AT.getTime() + HOUR_MS);

describe('which charges get an invoice (ADR 0027)', () => {
  it('issues one for a succeeded charge of a tenant with an invoicing connection', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection, charge } = await seedInvoicedTenant(tx);

      expect(await issueInvoicesWith(tx, invoicers.invoicerFor)(RUN_AT)).toEqual(ONE_ISSUED);

      expect(invoicers.invoicerOf(connection.invoicingConnectionId).calls.issue).toHaveLength(1);
      expect(await invoicesOf(tx, charge.chargeId)).toHaveLength(1);
    });
  });

  it('issues nothing for a tenant without an invoicing connection', async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      expect(await issueInvoicesWith(tx, fakeInvoicerFactory().invoicerFor)(RUN_AT)).toEqual(NOTHING_DONE);
      expect(await invoicesOf(tx, renewing.history[0]!.chargeId)).toEqual([]);
    });
  });

  it('invoices the succeeded charge but not one still pending', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const pending = await seedPendingRenewal(tx);
      const connection = await connectInvoicing(tx, pending);

      await issueInvoicesWith(tx, invoicers.invoicerFor)(LATER_RUN);

      expect(invoicers.invoicerOf(connection.invoicingConnectionId).calls.issue).toEqual([
        expect.objectContaining({ providerChargeRef: pending.history[0]!.providerChargeRef }),
      ]);
      expect(await invoicesOf(tx, pending.charge.chargeId)).toEqual([]);
    });
  });

  it('leaves alone charges taken before the tenant connected invoicing, so history is not invoiced twice', async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      await connectInvoicing(tx, renewing, AFTER_ACTIVATION);
      expect(await issueInvoicesWith(tx, fakeInvoicerFactory().invoicerFor)(LATER_RUN)).toEqual(NOTHING_DONE);
    });
  });

  it('issues each charge once, however many runs see it', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection } = await seedInvoicedTenant(tx);
      const issue = issueInvoicesWith(tx, invoicers.invoicerFor);

      await issue(RUN_AT);
      expect(await issue(LATER_RUN)).toEqual(NOTHING_DONE);

      expect(invoicers.invoicerOf(connection.invoicingConnectionId).calls.issue).toHaveLength(1);
    });
  });
});
