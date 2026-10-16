import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';
import { tenantsTable } from '@/lib/tenants/schema';
import type { FakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { insertOutboxEvent, type Delivery } from '@tests/utils/outbox-rows';
import type { SubscriptionOwner } from '@tests/utils/payment-method-rows';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import type { TenantFixture } from '@tests/utils/tenant-fixtures';

export type Receiver = SubscriptionOwner & { webhookSecret: string };

export const receivingAt = (endpoint: Pick<FakeTenantEndpoint, 'url'>, tenant: TenantFixture): TenantFixture => ({
  ...tenant,
  webhookUrl: endpoint.url,
});

export const seedReceiver = async (db: Database, tenant: TenantFixture): Promise<Receiver> => {
  const parents = await seedSubscriptionParents(db, tenant);
  const [subscription] = await insertSubscription(db, parents).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  const [secret] = await db
    .select({ webhookSecret: tenantsTable.webhookSecret })
    .from(tenantsTable)
    .where(eq(tenantsTable.tenantId, parents.tenantId));
  if (secret === undefined) throw new Error('seeded tenant not found');
  return {
    tenantId: parents.tenantId,
    subscriptionId: subscription.subscriptionId,
    providerConnectionId: subscription.providerConnectionId,
    ...secret,
  };
};

export const queueEvent = async (
  db: Database,
  owner: SubscriptionOwner,
  sequence = 1,
  delivery: Delivery = {},
): Promise<OutboxEvent> => {
  const [row] = await insertOutboxEvent(db, owner, sequence, delivery).returning();
  if (row === undefined) throw new Error('outbox insert returned no row');
  return row;
};

export const outboxRow = async (db: Database, { outboxEventId }: Pick<OutboxEvent, 'outboxEventId'>) => {
  const [row] = await db.select().from(outboxEventsTable).where(eq(outboxEventsTable.outboxEventId, outboxEventId));
  if (row === undefined) throw new Error('outbox row not found');
  return row;
};
