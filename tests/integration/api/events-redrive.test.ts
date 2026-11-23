import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { eventResponseSchema } from '@/contract/event-response';
import { DELIVERY_STATUS, type DeliveryStatus } from '@/lib/outbox/delivery-status';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';
import type { Database } from '@/lib/db';
import { testDb, withRollback } from '@tests/utils/db';
import { eventRedrivePath } from '@tests/utils/event-api';
import { insertOutboxEvent, type Delivery } from '@tests/utils/outbox-rows';
import { postNoBody } from '@tests/utils/subscription-api';
import { seedRenewing, type Renewing } from '@tests/utils/renewal-rows';
import { TEST_NOW, testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const FIRST_SEQUENCE = 1;
const ATTEMPTS_BEFORE_DEAD = 8;
const NOT_A_UUID = 'evt-1';
const DELIVERED_AT = new Date('2026-01-15T09:00:00.000Z');

const DEAD: Delivery = {
  deliveryStatus: DELIVERY_STATUS.DEAD,
  attempts: ATTEMPTS_BEFORE_DEAD,
  lastError: 'tenant endpoint answered 500',
};

const seedEvent = async (db: Database, { subscription }: Renewing, delivery: Delivery) => {
  const [event] = await insertOutboxEvent(db, subscription, FIRST_SEQUENCE, delivery).returning();
  if (event === undefined) throw new Error('outbox insert returned no row');
  return event;
};

const deliveryStatusOf = async (
  db: Database,
  outboxEventId: OutboxEvent['outboxEventId'],
): Promise<DeliveryStatus | undefined> => {
  const [row] = await db
    .select({ deliveryStatus: outboxEventsTable.deliveryStatus })
    .from(outboxEventsTable)
    .where(eq(outboxEventsTable.outboxEventId, outboxEventId));
  return row?.deliveryStatus;
};

describe('POST /v1/events/:eventId/redrive (dashboard slice 1)', () => {
  it('puts a dead event back in the queue for delivery now, with a fresh attempt count', async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      const event = await seedEvent(tx, renewing, DEAD);
      const res = await testApp(tx).request(eventRedrivePath(event.outboxEventId), postNoBody(renewing.ctx.apiKey));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(eventResponseSchema.parse(body)).toEqual(body);
      expect(body.data).toMatchObject({
        eventId: event.outboxEventId,
        deliveryStatus: DELIVERY_STATUS.PENDING,
        attempts: 0,
        lastError: null,
      });
      const [row] = await tx
        .select()
        .from(outboxEventsTable)
        .where(eq(outboxEventsTable.outboxEventId, event.outboxEventId));
      expect(row?.nextAttemptAt).toEqual(TEST_NOW);
    });
  });

  it('answers 409 for an event that is not dead, and leaves it alone', async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      const event = await seedEvent(tx, renewing, {
        deliveryStatus: DELIVERY_STATUS.DELIVERED,
        deliveredAt: DELIVERED_AT,
      });
      const res = await testApp(tx).request(eventRedrivePath(event.outboxEventId), postNoBody(renewing.ctx.apiKey));
      expect(res.status).toBe(409);
      expect(await deliveryStatusOf(tx, event.outboxEventId)).toBe(DELIVERY_STATUS.DELIVERED);
    });
  });

  it("answers 404 for another tenant's dead event and does not redrive it", async () => {
    await withRollback(testDb(), async (tx) => {
      const theirs = await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const event = await seedEvent(tx, theirs, DEAD);
      const res = await testApp(tx).request(eventRedrivePath(event.outboxEventId), postNoBody(ours.ctx.apiKey));
      expect(res.status).toBe(404);
      expect(await deliveryStatusOf(tx, event.outboxEventId)).toBe(DELIVERY_STATUS.DEAD);
    });
  });

  it.each([
    ['an unknown id', randomUUID()],
    ['an id that is not a UUID', NOT_A_UUID],
  ])('answers 404 for %s', async (_, id) => {
    await withRollback(testDb(), async (tx) => {
      const { ctx } = await seedRenewing(tx);
      const res = await testApp(tx).request(eventRedrivePath(id), postNoBody(ctx.apiKey));
      expect(res.status).toBe(404);
    });
  });
});
