import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { webhookEventsTable, type WebhookEvent } from '@/lib/webhooks/schema';

export const markWebhookProcessed = async (
  db: Database,
  webhookEventId: WebhookEvent['webhookEventId'],
  processedAt: Date,
): Promise<void> => {
  await db.update(webhookEventsTable).set({ processedAt }).where(eq(webhookEventsTable.webhookEventId, webhookEventId));
};
