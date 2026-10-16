import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { sha256Hex } from '@/lib/crypto/sha256-hex';
import type { PaymentProviderName } from '@/lib/payments/payment-provider-name';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { webhookEventsTable, type WebhookEvent } from '@/lib/webhooks/schema';

export type RecordWebhookInput = {
  providerConnectionId: ProviderConnection['providerConnectionId'];
  provider: PaymentProviderName;
  rawBody: string;
  receivedAt: Date;
};

export const recordWebhookEvent = async (db: Database, input: RecordWebhookInput): Promise<WebhookEvent> => {
  const dedupKey = sha256Hex(input.rawBody);
  await db
    .insert(webhookEventsTable)
    .values({ ...input, dedupKey, trusted: false })
    .onConflictDoNothing({ target: [webhookEventsTable.providerConnectionId, webhookEventsTable.dedupKey] });

  const [event] = await db
    .select()
    .from(webhookEventsTable)
    .where(
      and(
        eq(webhookEventsTable.providerConnectionId, input.providerConnectionId),
        eq(webhookEventsTable.dedupKey, dedupKey),
      ),
    )
    .limit(1);
  if (event === undefined) throw new Error('webhook event missing after insert');
  return event;
};
