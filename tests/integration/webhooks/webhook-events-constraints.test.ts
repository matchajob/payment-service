import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { webhookEventsTable } from '@/lib/webhooks/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { violatedConstraint } from '@tests/utils/violated-constraint';
import { insertWebhookEvent } from '@tests/utils/webhook-event-rows';

const DEDUP = 'webhook_events_dedup';
const PAYLOAD = '{"transactionId":"tx-1","status":"approved"}';
const GARBAGE = 'not json at all \u0000ÿ';

describe('webhook_events (Spec 4 rule 1, ADR 0010 amendment 5)', () => {
  it('stores the same payload only once per connection', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      await insertWebhookEvent(tx, providerConnectionId, PAYLOAD);
      const replay = (db: Database) => insertWebhookEvent(db, providerConnectionId, PAYLOAD);
      expect(await violatedConstraint(tx, replay)).toBe(DEDUP);
    });
  });

  it('stores the same payload separately for two connections', async () => {
    await withRollback(testDb(), async (tx) => {
      const first = await seedConnection(tx);
      const second = await seedConnection(tx);
      await insertWebhookEvent(tx, first.providerConnectionId, PAYLOAD);
      const other = (db: Database) => insertWebhookEvent(db, second.providerConnectionId, PAYLOAD);
      expect(await violatedConstraint(tx, other)).toBeUndefined();
    });
  });

  it.each([
    ['garbage that is not JSON', GARBAGE.replace('\u0000', '')],
    ['an empty body', ''],
  ])('keeps %s byte for byte, so it can be inspected later', async (_, rawBody) => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      const [row] = await insertWebhookEvent(tx, providerConnectionId, rawBody).returning();
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
