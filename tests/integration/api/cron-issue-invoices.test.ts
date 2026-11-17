import { describe, expect, it } from 'vitest';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { TEST_CRON_TOKEN } from '@tests/utils/fake-cron-token-verifier';
import { seedInvoicedTenant } from '@tests/utils/invoicing-rows';
import { ISSUE_INVOICES_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';

const POST = { method: 'POST' } as const;

describe('POST /internal/cron/issue-invoices (ADR 0027)', () => {
  it("issues what is due at the app's clock and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection } = await seedInvoicedTenant(tx);
      const res = await testApp(tx, { invoicerFor: invoicers.invoicerFor }).request(ISSUE_INVOICES_PATH, {
        ...bearer(TEST_CRON_TOKEN),
        ...POST,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0 });
      expect(invoicers.invoicerOf(connection.invoicingConnectionId).issued()).toHaveLength(1);
    });
  });

  it('stays 200 when the invoicing service fails, because the retry schedule handles it, as drain-outbox does (ADR 0026)', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection } = await seedInvoicedTenant(tx);
      invoicers.invoicerOf(connection.invoicingConnectionId).failNextIssue();
      const res = await testApp(tx, { invoicerFor: invoicers.invoicerFor }).request(ISSUE_INVOICES_PATH, {
        ...bearer(TEST_CRON_TOKEN),
        ...POST,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 0, failed: 1 });
    });
  });

  it('rejects a call without the cron token and issues nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const invoicers = fakeInvoicerFactory();
      const { connection } = await seedInvoicedTenant(tx);
      const res = await testApp(tx, { invoicerFor: invoicers.invoicerFor }).request(ISSUE_INVOICES_PATH, POST);
      expect(res.status).toBe(401);
      expect(invoicers.invoicerOf(connection.invoicingConnectionId).calls.issue).toEqual([]);
    });
  });
});
