import { describe, expect, it } from 'vitest';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';
import type { Database } from '@/lib/db';
import { testDb, withRollback } from '@tests/utils/db';
import { insertOutboxEvent, snapshotFor } from '@tests/utils/outbox-rows';
import { seedSubscriptionOwner } from '@tests/utils/payment-method-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const ONE_PER_SEQUENCE = 'outbox_events_one_per_sequence';
const SEQUENCE_CHECK = 'outbox_events__chk__sequence';

describe('outbox_events (Spec 5)', () => {
  it('stores the full snapshot and reads it back unchanged (D12 fat events)', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      const [row] = await insertOutboxEvent(tx, owner, 1).returning();
      expect(row?.snapshot).toEqual(snapshotFor(owner));
      expect(subscriptionSnapshotSchema.parse(row?.snapshot)).toEqual(snapshotFor(owner));
    });
  });

  it('gives each sequence number of a subscription to exactly one event (rule 4 ordering)', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      await insertOutboxEvent(tx, owner, 1);
      const duplicate = (db: Database) => insertOutboxEvent(db, owner, 1);
      expect(await violatedConstraint(tx, duplicate)).toBe(ONE_PER_SEQUENCE);
    });
  });

  it('starts sequences at 1, so a receiver storing 0 applies the first event', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      const zero = (db: Database) => insertOutboxEvent(db, owner, 0);
      expect(await violatedConstraint(tx, zero)).toBe(SEQUENCE_CHECK);
    });
  });
});
