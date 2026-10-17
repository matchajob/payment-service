import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { paymentMethodUpdatesTable } from '@/lib/payment-method-updates/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { seedSubscriptionOwner, type SubscriptionOwner } from '@tests/utils/payment-method-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const ONE_PER_SESSION = 'payment_method_updates_one_per_session';
const SUBSCRIPTION_CONNECTION = 'payment_method_updates_subscription_connection';
const SESSION = 'session-1';
const REQUESTED_AT = new Date('2026-02-01T10:00:00.000Z');

const insertUpdate = (db: Database, owner: SubscriptionOwner, sessionRef: string = SESSION) =>
  db.insert(paymentMethodUpdatesTable).values({ ...owner, sessionRef, requestedAt: REQUESTED_AT, completedAt: null });

describe('payment_method_updates table constraints (ADR 0018)', () => {
  it('rejects a second request with the same session on the same connection', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      await insertUpdate(tx, owner);
      expect(await violatedConstraint(tx, (db) => insertUpdate(db, owner))).toBe(ONE_PER_SESSION);
    });
  });

  it("rejects a request on a connection other than the subscription's pinned one", async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      const other = await seedConnection(tx);
      const write = (db: Database) => insertUpdate(db, { ...owner, providerConnectionId: other.providerConnectionId });
      expect(await violatedConstraint(tx, write)).toBe(SUBSCRIPTION_CONNECTION);
    });
  });
});
