import { unique } from '@matcha/infra/domain-drizzle/exports';
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

const FIRST_SEQUENCE = 1;

export const outboundEventTypeEnum = createDbEnumPair('outboundEventType', OUTBOUND_EVENT_TYPE);
export const outboundEventTypePgEnum = outboundEventTypeEnum.dz;

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
  },
  {
    extraConstraints: (t) => [unique('outbox_events_one_per_sequence').on(t.subscriptionId, t.sequence)],
  },
);

export const outboxEventsTable = outboxEventsEntity.table;

export type OutboxEvent = typeof outboxEventsTable.$inferSelect;
