import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { outboundEventSchema } from '@/contract/outbound-event';
import type { SubscriptionSnapshot } from '@/contract/subscription-snapshot';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { zOutboxEventRead } from '@/lib/outbox/schema';
import { toOutboundEvent } from '@/lib/outbox/to-outbound-event';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

const OCCURRED_AT = new Date('2026-01-15T10:00:00.000Z');
const SUBSCRIPTION_ID = randomUUID();
const SEQUENCE = 3;

const SNAPSHOT: SubscriptionSnapshot = {
  subscriptionId: SUBSCRIPTION_ID,
  customerId: randomUUID(),
  customerExternalRef: 'user-42',
  planId: randomUUID(),
  status: SUBSCRIPTION_STATUS.ACTIVE,
  entitled: true,
  currentPeriodEnd: '2026-02-15T10:00:00.000Z',
  cancelAtPeriodEnd: false,
  cancelReason: null,
};

const row = zOutboxEventRead.parse({
  outboxEventId: randomUUID(),
  tenantId: randomUUID(),
  subscriptionId: SUBSCRIPTION_ID,
  eventType: OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED,
  sequence: SEQUENCE,
  snapshot: SNAPSHOT,
  occurredAt: OCCURRED_AT,
  deliveryStatus: DELIVERY_STATUS.PENDING,
  attempts: 1,
  nextAttemptAt: OCCURRED_AT,
  deliveredAt: null,
  lastError: null,
});

describe('toOutboundEvent (D12 fat event)', () => {
  it('carries the event id for receiver dedup, the sequence for ordering, and the full snapshot', () => {
    expect(toOutboundEvent(row)).toEqual({
      eventId: row.outboxEventId,
      type: OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED,
      sequence: SEQUENCE,
      occurredAt: OCCURRED_AT.toISOString(),
      subscription: SNAPSHOT,
    });
  });

  it('conforms to the published contract with no extra fields, so no delivery bookkeeping leaks to tenants', () => {
    const event = toOutboundEvent(row);
    expect(outboundEventSchema.parse(event)).toEqual(event);
  });

  it('refuses a stored snapshot that no longer matches the contract, rather than sending it', () => {
    const corrupt = { ...row, snapshot: { ...SNAPSHOT, status: 'paused' } };
    expect(() => toOutboundEvent(corrupt)).toThrow();
  });
});
