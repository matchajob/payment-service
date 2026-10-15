import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { dzdThemeJson } from '@matcha/infra/dzd/dzd-json';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { tenantsTable } from '@/lib/tenants/schema';
import { sql } from 'drizzle-orm';
import { check, index, unique } from '@matcha/infra/domain-drizzle/exports';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { NO_ATTEMPTS } from '@/lib/outbox/new-delivery';
import { sqlLiteral } from '@/lib/sql-literal';

const FIRST_SEQUENCE = 1;

export const outboundEventTypeEnum = createDbEnumPair('outboundEventType', OUTBOUND_EVENT_TYPE);
export const outboundEventTypePgEnum = outboundEventTypeEnum.dz;
export const deliveryStatusEnum = createDbEnumPair('deliveryStatus', DELIVERY_STATUS);
export const deliveryStatusPgEnum = deliveryStatusEnum.dz;

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };

export const outboxEventsEntity = defineEntity(
  'outbox_events',
  {
    outboxEventId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'OutboxEventId')),
    tenantId: (f) =>
      entityFromDzd(dzdThemeUuid.requiredRef(f, { ref: () => tenantsTable.tenantId, actions: restrict }, 'TenantId')),
    subscriptionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => subscriptionsTable.subscriptionId, actions: restrict },
          'SubscriptionId',
        ),
      ),
    eventType: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, outboundEventTypeEnum)),
    sequence: (f) => entityFromDzd(makeDzdInteger(f, { minSize: FIRST_SEQUENCE })),
    snapshot: (f) => entityFromDzd(dzdThemeJson.object(f, subscriptionSnapshotSchema)),
    occurredAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    deliveryStatus: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, deliveryStatusEnum)),
    attempts: (f) => entityFromDzd(makeDzdInteger(f, { minSize: NO_ATTEMPTS })),
    nextAttemptAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    deliveredAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    lastError: (f) => entityFromDzd(dzdThemeStr.nonEmpty.errorMessage(f), DZD_NULLABLE),
  },
  {
    extraConstraints: (t) => [
    unique('outbox_events_one_per_sequence').on(t.subscriptionId, t.sequence),
    check(
      'outbox_events_delivered_at_iff_delivered',
      sql`(${t.deliveryStatus} = ${sqlLiteral(DELIVERY_STATUS.DELIVERED)}) = (${t.deliveredAt} is not null)`,
    ),
    check(
      'outbox_events_dead_has_last_error',
      sql`${t.deliveryStatus} <> ${sqlLiteral(DELIVERY_STATUS.DEAD)} or ${t.lastError} is not null`,
    ),
    index('outbox_events_due')
      .on(t.nextAttemptAt)
      .where(sql`${t.deliveryStatus} = ${sqlLiteral(DELIVERY_STATUS.PENDING)}`),
    ], 
  }
);

export const outboxEventsTable = outboxEventsEntity.table;

export type OutboxEvent = typeof outboxEventsTable.$inferSelect;
