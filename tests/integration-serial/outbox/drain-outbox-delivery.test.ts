import { describe, expect, it } from 'vitest';
import { outboundEventSchema } from '@/contract/outbound-event';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/lib/outbox/delivery-headers';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { DRAIN_BATCH_SIZE } from '@/lib/outbox/delivery-timing';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { signPayload } from '@/lib/outbox/sign-payload';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const NOW_UNIX_SECONDS = '1768471200';
const LATER = new Date(NOW.getTime() + 1);
const JSON_CONTENT_TYPE = 'application/json';

describe('drainOutbox: delivery (Spec 5 rules 2, 3, 5)', () => {
  const db = truncateModeDb();

  it('POSTs a due event to the tenant webhookUrl and marks it delivered on 2xx', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 1, failed: 0 });
    expect(endpoint.deliveries).toHaveLength(1);
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.DELIVERED,
      deliveredAt: NOW,
      attempts: 1,
    });
  });

  it('sends the published contract with no extra fields, keyed by the outbox event id', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    await drainOutbox(db, NOW);
    const [delivery] = endpoint.deliveries;
    const body = JSON.parse(delivery?.body ?? '');
    expect(outboundEventSchema.parse(body)).toEqual(body);
    expect(body.eventId).toBe(event.outboxEventId);
    expect(delivery?.header('content-type')).toBe(JSON_CONTENT_TYPE);
  });

  it('signs exactly the bytes it sends with the tenant webhook secret (rule 5)', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    await queueEvent(db, receiver);
    await drainOutbox(db, NOW);
    const [delivery] = endpoint.deliveries;
    const timestamp = Number(delivery?.header(TIMESTAMP_HEADER));
    expect(delivery?.header(SIGNATURE_HEADER)).toBe(
      signPayload(receiver.webhookSecret, timestamp, delivery?.body ?? ''),
    );
  });

  it('stamps the timestamp header with the drain time in unix seconds, for the receiver 5-minute check', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    await queueEvent(db, receiver);
    await drainOutbox(db, NOW);
    expect(endpoint.deliveries[0]?.header(TIMESTAMP_HEADER)).toBe(NOW_UNIX_SECONDS);
  });

  it('leaves an event that is not due yet alone', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver, 1, { nextAttemptAt: LATER });
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 0, failed: 0 });
    expect(endpoint.deliveries).toEqual([]);
    expect(await outboxRow(db, event)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.PENDING, attempts: 0 });
  });

  it('never sends a delivered or a dead event again', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    await queueEvent(db, receiver, 1, { deliveryStatus: DELIVERY_STATUS.DELIVERED, attempts: 1, deliveredAt: NOW });
    await queueEvent(db, receiver, 2, {
      deliveryStatus: DELIVERY_STATUS.DEAD,
      attempts: MAX_DELIVERY_ATTEMPTS,
      lastError: 'HTTP 500',
    });
    expect(await drainOutbox(db, LATER)).toEqual({ processed: 0, failed: 0 });
    expect(endpoint.deliveries).toEqual([]);
  });

  it('claims at most one batch per run and leaves the rest for the next tick', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const sequences = Array.from({ length: DRAIN_BATCH_SIZE + 1 }, (_, index) => index + 1);
    await Promise.all(sequences.map((sequence) => queueEvent(db, receiver, sequence)));
    expect(await drainOutbox(db, NOW)).toEqual({ processed: DRAIN_BATCH_SIZE, failed: 0 });
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 1, failed: 0 });
  });
});
