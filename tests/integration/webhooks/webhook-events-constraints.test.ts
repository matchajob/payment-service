import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { webhookEventsTable } from '@/lib/webhooks/schema';
import { createTenant } from '@/lib/tenants/create-tenant';
import { testDb, withRollback } from '@tests/utils/db';
import { GLOBEX, ACME } from '@tests/utils/tenant-fixtures';
import { violatedConstraint } from '@tests/utils/violated-constraint';
import { insertWebhookEvent } from '@tests/utils/webhook-event-rows';

const DEDUP = 'webhook_events_dedup';
const PAYLOAD = '{"transactionId":"tx-1","status":"approved"}';
const GARBAGE = 'not json at all \u0000ÿ';

describe('webhook_events (Spec 4 rule 1)', () => {
  it('stores the same payload only once per tenant and provider', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, ACME);
      await insertWebhookEvent(tx, tenant.tenantId, PAYLOAD);
      const replay = (db: Database) => insertWebhookEvent(db, tenant.tenantId, PAYLOAD);
      expect(await violatedConstraint(tx, replay)).toBe(DEDUP);
    });
  });

  it('stores the same payload separately for two tenants', async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await createTenant(tx, ACME);
      const globex = await createTenant(tx, GLOBEX);
      await insertWebhookEvent(tx, acme.tenant.tenantId, PAYLOAD);
      const other = (db: Database) => insertWebhookEvent(db, globex.tenant.tenantId, PAYLOAD);
      expect(await violatedConstraint(tx, other)).toBeUndefined();
    });
  });

  it.each([
    ['garbage that is not JSON', GARBAGE.replace('\u0000', '')],
    ['an empty body', ''],
  ])('keeps %s byte for byte, so it can be inspected later', async (_, rawBody) => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, ACME);
      const [row] = await insertWebhookEvent(tx, tenant.tenantId, rawBody).returning();
      expect(row?.rawBody).toBe(rawBody);
      expect(row?.processedAt).toBeNull();
    });
  });

  it('is empty after a rollback, as a guard that each test starts clean', async () => {
    await withRollback(testDb(), async (tx) => {
      expect(await tx.$count(webhookEventsTable)).toBe(0);
    });
  });
});
