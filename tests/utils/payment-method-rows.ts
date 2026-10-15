import type { Database } from '@/lib/db';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import type { Subscription } from '@/lib/subscriptions/schema';
import type { Tenant } from '@/lib/tenants/schema';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';

export type SubscriptionOwner = { tenantId: Tenant['tenantId']; subscriptionId: Subscription['subscriptionId'] };

export const seedSubscriptionOwner = async (db: Database): Promise<SubscriptionOwner> => {
  const parents = await seedSubscriptionParents(db);
  const [subscription] = await insertSubscription(db, parents).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  return { tenantId: parents.tenantId, subscriptionId: subscription.subscriptionId };
};

export const insertPaymentMethod = (
  db: Database,
  owner: SubscriptionOwner,
  captureRef: string,
  replacedAt: Date | null = null,
) => db.insert(paymentMethodsTable).values({ ...owner, providerToken: `token-${captureRef}`, captureRef, replacedAt });
