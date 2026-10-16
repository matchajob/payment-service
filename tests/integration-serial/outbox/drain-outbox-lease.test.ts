import { describe, expect, it } from 'vitest';
import { claimDueEvents } from '@/lib/outbox/claim-due-events';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { LEASE_MS } from '@/lib/outbox/delivery-timing';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { recordDeliveryResult } from '@/lib/outbox/record-delivery-result';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const at = (ms: number) => new Date(NOW.getTime() + ms);
const DELIVERED = { delivered: true } as const;
const FAILED = { delivered: false, error: 'HTTP 500' } as const;

describe('drainOutbox: lease and fence (ADR 0009)', () => {
  const db = truncateModeDb();

  it('counts the attempt at claim time and hides the row until the lease runs out', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    expect(await claimDueEvents(db, NOW)).toHaveLength(1);
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.PENDING,
      attempts: 1,
      nextAttemptAt: at(LEASE_MS),
    });
    expect(await claimDueEvents(db, at(LEASE_MS - 1))).toEqual([]);
  });

  it('delivers after a crash mid-POST, once the lease expires, with the crashed attempt still counted', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    await claimDueEvents(db, NOW);
    expect(await drainOutbox(db, at(LEASE_MS))).toEqual({ processed: 1, failed: 0 });
    expect(await outboxRow(db, event)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.DELIVERED, attempts: 2 });
  });

  it('ignores a late failure from an expired lease, so it cannot undo a later delivery', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    const [stale] = await claimDueEvents(db, NOW);
    const [current] = await claimDueEvents(db, at(LEASE_MS));
    if (stale === undefined || current === undefined) throw new Error('expected both claims to return the row');
    await recordDeliveryResult(db, current, DELIVERED, at(LEASE_MS));
    await recordDeliveryResult(db, stale, FAILED, at(LEASE_MS));
    expect(await outboxRow(db, event)).toMatchObject({
      deliveryStatus: DELIVERY_STATUS.DELIVERED,
      attempts: 2,
      lastError: null,
    });
  });

  it('ignores a late success from an expired lease while the newer attempt is still in flight', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver);
    const [stale] = await claimDueEvents(db, NOW);
    await claimDueEvents(db, at(LEASE_MS));
    if (stale === undefined) throw new Error('expected the first claim to return the row');
    await recordDeliveryResult(db, stale, DELIVERED, at(LEASE_MS));
    expect(await outboxRow(db, event)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.PENDING, attempts: 2 });
  });
});
