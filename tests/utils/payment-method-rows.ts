import type { Database } from '@/lib/db';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import type { Subscription } from '@/lib/subscriptions/schema';
import type { Tenant } from '@/lib/tenants/schema';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';

export type SubscriptionOwner = {
  tenantId: Tenant['tenantId'];
  subscriptionId: Subscription['subscriptionId'];
  providerConnectionId: ProviderConnection['providerConnectionId'];
};

export const seedSubscriptionOwner = async (db: Database, tenant: TenantFixture = ACME): Promise<SubscriptionOwner> => {
  const parents = await seedSubscriptionParents(db, tenant);
  const [subscription] = await insertSubscription(db, parents).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  return {
    tenantId: parents.tenantId,
    subscriptionId: subscription.subscriptionId,
    providerConnectionId: subscription.providerConnectionId,
  };
};

export const insertPaymentMethod = (
  db: Database,
  owner: SubscriptionOwner,
  captureRef: string,
  replacedAt: Date | null = null,
) => db.insert(paymentMethodsTable).values({ ...owner, providerToken: `token-${captureRef}`, captureRef, replacedAt });
