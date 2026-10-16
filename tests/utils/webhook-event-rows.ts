import type { Database } from '@/lib/db';
import { sha256Hex } from '@/lib/crypto/sha256-hex';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { webhookEventsTable } from '@/lib/webhooks/schema';

export const RECEIVED_AT = new Date('2026-01-15T10:00:00.000Z');

export const insertWebhookEvent = (
  db: Database,
  providerConnectionId: ProviderConnection['providerConnectionId'],
  rawBody: string,
) =>
  db.insert(webhookEventsTable).values({
    providerConnectionId,
    provider: PAYMENT_PROVIDER.GROW,
    dedupKey: sha256Hex(rawBody),
    rawBody,
    trusted: false,
    receivedAt: RECEIVED_AT,
  });
