import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { retryDelayAfter } from '@/lib/outbox/retry-schedule';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { closedEndpointUrl, fakeTenantEndpoint, HANG, REDIRECT_TARGET_PATH } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT, snapshotFor } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const FIRST_RETRY_DELAY = retryDelayAfter(1) ?? 0;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const SHORT_TIMEOUT_MS = 50;
const SERVER_ERROR = 500;
const FOUND = 302;
const TIMEOUT_ERROR = 'timeout';

describe('drainOutbox: retries (Spec 5 rule 2, ADR 0009)', () => {
  const db = truncateModeDb();

  it('after a 500, schedules the first Svix retry and keeps the error', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(SERVER_ERROR);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 0, failed: 1 });
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.PENDING,
      attempts: 1,
      nextAttemptAt: at(FIRST_RETRY_DELAY),
      lastError: `HTTP ${SERVER_ERROR}`,
    });
  });

  it('a 500 then a 200 delivers once, and not before the backoff has passed', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(SERVER_ERROR);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    await drainOutbox(db, NOW);
    expect(await drainOutbox(db, at(FIRST_RETRY_DELAY - 1))).toEqual({ processed: 0, failed: 0 });
    expect(await drainOutbox(db, at(FIRST_RETRY_DELAY))).toEqual({ processed: 1, failed: 0 });
    expect(endpoint.deliveries).toHaveLength(2);
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.DELIVERED,
      deliveredAt: at(FIRST_RETRY_DELAY),
      attempts: 2,
    });
  });

  it('counts a receiver that never answers as a failed attempt once the timeout passes', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(HANG);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    expect(await drainOutbox(db, NOW, SHORT_TIMEOUT_MS)).toEqual({ processed: 0, failed: 1 });
    expect(await outboxRow(db, event)).toMatchObject({ attempts: 1, lastError: TIMEOUT_ERROR });
  });

  it('counts a redirect as a failed attempt and never follows it with the signed payload', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(FOUND);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 0, failed: 1 });
    expect(endpoint.deliveries.map(({ path }) => path)).not.toContain(REDIRECT_TARGET_PATH);
    expect(await outboxRow(db, event)).toMatchObject({ lastError: `HTTP ${FOUND}` });
  });

  it('counts an unreachable receiver as a failed attempt', async () => {
    const receiver = await seedReceiver(db, { ...ACME, webhookUrl: await closedEndpointUrl() });
    const event = await queueEvent(db, receiver);
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 0, failed: 1 });
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.PENDING,
      attempts: 1,
      lastError: expect.any(String),
    });
  });

  it('counts a stored snapshot that breaks the contract as a failed attempt, and still sends the rest', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const corrupt = await queueEvent(db, receiver, 1);
    const healthy = await queueEvent(db, receiver, 2);
    await db
      .update(outboxEventsTable)
      .set({ snapshot: { ...snapshotFor(receiver), status: 'paused' } })
      .where(eq(outboxEventsTable.outboxEventId, corrupt.outboxEventId));
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 1, failed: 1 });
    expect(endpoint.deliveries).toHaveLength(1);
    expect(await outboxRow(db, corrupt)).toMatchObject({ attempts: 1, lastError: expect.any(String) });
    expect(await outboxRow(db, healthy)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.DELIVERED });
  });
});
