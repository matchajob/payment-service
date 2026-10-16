import { unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeBool } from '@matcha/infra/dzd/dzd-boolean';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { dzdThemeStr, makeDzdString } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { StrMaxSizes, StrMinSizes } from '@matcha/infra/validations/z-string';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { paymentProviderEnum } from '@/lib/payments/schema';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';

export const webhookEventsEntity = defineEntity(
  'webhook_events',
  {
    webhookEventId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'WebhookEventId')),
    providerConnectionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          {
            ref: () => providerConnectionsTable.providerConnectionId,
            actions: { onDelete: REFERENTIAL_ACTION.RESTRICT },
          },
          'ProviderConnectionId',
        ),
      ),
    provider: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, paymentProviderEnum)),
    dedupKey: (f) => entityFromDzd(dzdThemeStr.hash(f)),
    rawBody: (f) => entityFromDzd(makeDzdString(f, { maxSize: StrMaxSizes.blob, minSize: StrMinSizes.empty })),
    trusted: (f) => entityFromDzd(dzdThemeBool.required(f)),
    receivedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    processedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
  },
  {
    extraConstraints: (t) => [unique('webhook_events_dedup').on(t.providerConnectionId, t.dedupKey)],
  },
);

export const webhookEventsTable = webhookEventsEntity.table;
export const zWebhookEventRead = webhookEventsEntity.read;

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
