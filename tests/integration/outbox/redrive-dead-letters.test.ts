import { describe, expect, it } from 'vitest';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { redriveDeadLetters } from '@/lib/outbox/redrive-dead-letters';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { testDb, withRollback } from '@tests/utils/db';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, seedReceiver } from '@tests/utils/queued-events';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';

const NOW = new Date('2026-01-20T09:00:00.000Z');
const DEAD = {
  deliveryStatus: DELIVERY_STATUS.DEAD,
  attempts: MAX_DELIVERY_ATTEMPTS,
  lastError: 'HTTP 500',
} as const;
const DELIVERED = { deliveryStatus: DELIVERY_STATUS.DELIVERED, attempts: 1, deliveredAt: OCCURRED_AT } as const;
const RETRYING = { attempts: 2, lastError: 'HTTP 503' } as const;

describe('redriveDeadLetters (Spec 5 rule 7, D13)', () => {
  it('re-queues a dead event as a fresh delivery, due now', async () => {
    await withRollback(testDb(), async (tx) => {
      const receiver = await seedReceiver(tx, ACME);
      const dead = await queueEvent(tx, receiver, 1, DEAD);
      expect(await redriveDeadLetters(tx, { outboxEventId: dead.outboxEventId }, NOW)).toBe(1);
      expect(await outboxRow(tx, dead)).toMatchObject({
        deliveryStatus: DELIVERY_STATUS.PENDING,
        attempts: 0,
        nextAttemptAt: NOW,
        lastError: null,
        deliveredAt: null,
      });
    });
  });

  it('touches only the named event', async () => {
    await withRollback(testDb(), async (tx) => {
      const receiver = await seedReceiver(tx, ACME);
      const named = await queueEvent(tx, receiver, 1, DEAD);
      const other = await queueEvent(tx, receiver, 2, DEAD);
      await redriveDeadLetters(tx, { outboxEventId: named.outboxEventId }, NOW);
      expect(await outboxRow(tx, other)).toMatchObject(DEAD);
    });
  });

  it('re-queues every dead event of one tenant, and none of another', async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await seedReceiver(tx, ACME);
      const globex = await seedReceiver(tx, GLOBEX);
      await queueEvent(tx, acme, 1, DEAD);
      await queueEvent(tx, acme, 2, DEAD);
      const globexDead = await queueEvent(tx, globex, 1, DEAD);
      expect(await redriveDeadLetters(tx, { tenantId: acme.tenantId }, NOW)).toBe(2);
      expect(await outboxRow(tx, globexDead)).toMatchObject(DEAD);
    });
  });

  it('leaves delivered and still-retrying events alone, so redrive never causes a resend', async () => {
    await withRollback(testDb(), async (tx) => {
      const receiver = await seedReceiver(tx, ACME);
      const delivered = await queueEvent(tx, receiver, 1, DELIVERED);
      const retrying = await queueEvent(tx, receiver, 2, RETRYING);
      expect(await redriveDeadLetters(tx, { tenantId: receiver.tenantId }, NOW)).toBe(0);
      expect(await outboxRow(tx, delivered)).toMatchObject(DELIVERED);
      expect(await outboxRow(tx, retrying)).toMatchObject(RETRYING);
    });
  });
});
