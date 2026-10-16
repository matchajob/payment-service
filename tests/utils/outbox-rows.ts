import type { SubscriptionSnapshot } from '@/contract/subscription-snapshot';
import type { Database } from '@/lib/db';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import type { SubscriptionOwner } from '@tests/utils/payment-method-rows';

export const OCCURRED_AT = new Date('2026-01-15T10:00:00.000Z');

export type Delivery = Partial<
  Pick<
    typeof outboxEventsTable.$inferInsert,
    'deliveryStatus' | 'attempts' | 'nextAttemptAt' | 'deliveredAt' | 'lastError'
  >
>;

export const NEW_DELIVERY = {
  deliveryStatus: DELIVERY_STATUS.PENDING,
  attempts: 0,
  nextAttemptAt: OCCURRED_AT,
  deliveredAt: null,
  lastError: null,
} as const;

type EventOwner = Pick<SubscriptionOwner, 'tenantId' | 'subscriptionId'>;

export const snapshotFor = ({ subscriptionId }: Pick<SubscriptionOwner, 'subscriptionId'>): SubscriptionSnapshot => ({
  subscriptionId,
  customerId: '7d1c6a1e-2f3b-4c5d-8e9f-0a1b2c3d4e5f',
  customerExternalRef: 'user-42',
  planId: '0f9e8d7c-6b5a-4c3d-9e1f-2a3b4c5d6e7f',
  status: SUBSCRIPTION_STATUS.ACTIVE,
  entitled: true,
  currentPeriodEnd: '2026-02-15T10:00:00.000Z',
  cancelAtPeriodEnd: false,
  cancelReason: null,
  canceledAt: null,
});

export const insertOutboxEvent = (
  db: Database,
  { tenantId, subscriptionId }: EventOwner,
  sequence: number,
  delivery: Delivery = {},
) =>
  db.insert(outboxEventsTable).values({
    tenantId,
    subscriptionId,
    eventType: OUTBOUND_EVENT_TYPE.SUBSCRIPTION_ACTIVATED,
    sequence,
    snapshot: snapshotFor({ subscriptionId }),
    occurredAt: OCCURRED_AT,
    ...NEW_DELIVERY,
    ...delivery,
  });
