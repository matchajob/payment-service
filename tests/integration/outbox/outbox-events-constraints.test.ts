import { describe, expect, it } from 'vitest';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';
import type { Database } from '@/lib/db';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { testDb, withRollback } from '@tests/utils/db';
import { insertOutboxEvent, OCCURRED_AT, snapshotFor } from '@tests/utils/outbox-rows';
import { seedSubscriptionOwner } from '@tests/utils/payment-method-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const ONE_PER_SEQUENCE = 'outbox_events_one_per_sequence';
const SEQUENCE_CHECK = 'outbox_events__chk__sequence';
const ATTEMPTS_CHECK = 'outbox_events__chk__attempts';
const DELIVERED_AT_IFF_DELIVERED = 'outbox_events_delivered_at_iff_delivered';
const DEAD_HAS_LAST_ERROR = 'outbox_events_dead_has_last_error';
const LAST_ERROR = 'HTTP 503';

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

  describe('delivery state (rules 2 and 6, ADR 0009)', () => {
    it('rejects negative attempts, so the dead-letter count cannot be gamed', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedSubscriptionOwner(tx);
        const negative = (db: Database) => insertOutboxEvent(db, owner, 1, { attempts: -1 });
        expect(await violatedConstraint(tx, negative)).toBe(ATTEMPTS_CHECK);
      });
    });

    it('rejects a delivered row with no deliveredAt', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedSubscriptionOwner(tx);
        const delivered = (db: Database) =>
          insertOutboxEvent(db, owner, 1, { deliveryStatus: DELIVERY_STATUS.DELIVERED, attempts: 1 });
        expect(await violatedConstraint(tx, delivered)).toBe(DELIVERED_AT_IFF_DELIVERED);
      });
    });

    it('rejects a deliveredAt on a row that is not delivered', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedSubscriptionOwner(tx);
        const pending = (db: Database) => insertOutboxEvent(db, owner, 1, { deliveredAt: OCCURRED_AT });
        expect(await violatedConstraint(tx, pending)).toBe(DELIVERED_AT_IFF_DELIVERED);
      });
    });

    it('rejects a dead row with no lastError (rule 6: the last error is retained)', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedSubscriptionOwner(tx);
        const dead = (db: Database) =>
          insertOutboxEvent(db, owner, 1, { deliveryStatus: DELIVERY_STATUS.DEAD, attempts: MAX_DELIVERY_ATTEMPTS });
        expect(await violatedConstraint(tx, dead)).toBe(DEAD_HAS_LAST_ERROR);
      });
    });

    it('accepts a dead row with its last error, and a pending retry that keeps the previous one', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedSubscriptionOwner(tx);
        await insertOutboxEvent(tx, owner, 1, { deliveryStatus: DELIVERY_STATUS.DEAD, attempts: MAX_DELIVERY_ATTEMPTS, lastError: LAST_ERROR });
        await insertOutboxEvent(tx, owner, 2, { attempts: 1, lastError: LAST_ERROR });
      });
    });
  });
});
