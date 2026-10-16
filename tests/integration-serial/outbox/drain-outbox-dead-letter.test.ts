import { describe, expect, it } from 'vitest';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { LEASE_EXPIRED_ERROR } from '@/lib/outbox/lease-expired-error';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { MAX_DELIVERY_ATTEMPTS, retryDelayAfter } from '@/lib/outbox/retry-schedule';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1_000;
const MUCH_LATER = new Date(NOW.getTime() + MS_PER_YEAR);
const SERVER_ERROR = 500;
const UNAVAILABLE = 503;

describe('drainOutbox: dead letter (Spec 5 rule 6, ADR 0009)', () => {
  const db = truncateModeDb();

  it('dead-letters on the 8th failed attempt and keeps that attempt error', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(UNAVAILABLE);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver, 1, {
      attempts: MAX_DELIVERY_ATTEMPTS - 1,
      lastError: `HTTP ${SERVER_ERROR}`,
    });
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 0, failed: 1 });
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.DEAD,
      attempts: MAX_DELIVERY_ATTEMPTS,
      lastError: `HTTP ${UNAVAILABLE}`,
    });
  });

  it('walks the whole schedule: 8 attempts on the Svix delays, then dead, and no 9th attempt ever', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(...Array.from({ length: MAX_DELIVERY_ATTEMPTS + 1 }, () => SERVER_ERROR));
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    const attemptTimes = Array.from({ length: MAX_DELIVERY_ATTEMPTS }, (_, index) =>
      Array.from({ length: index }, (__, failed) => retryDelayAfter(failed + 1) ?? 0).reduce(
        (sum, delay) => sum + delay,
        NOW.getTime(),
      ),
    );
    for (const time of attemptTimes) await drainOutbox(db, new Date(time));
    await drainOutbox(db, MUCH_LATER);
    expect(endpoint.deliveries).toHaveLength(MAX_DELIVERY_ATTEMPTS);
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.DEAD,
      attempts: MAX_DELIVERY_ATTEMPTS,
    });
  });

  it('dead-letters an 8th attempt whose lease expired with no result, without a 9th POST', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver, 1, { attempts: MAX_DELIVERY_ATTEMPTS });
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 0, failed: 1 });
    expect(endpoint.deliveries).toEqual([]);
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.DEAD,
      attempts: MAX_DELIVERY_ATTEMPTS,
      lastError: LEASE_EXPIRED_ERROR,
    });
  });
});
