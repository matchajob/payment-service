import { findCustomer } from '@/lib/customers/find-customer';
import type { Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { COMMAND_RESULT, type CommandResult } from '@/lib/subscriptions/command-result';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import type { Subscription } from '@/lib/subscriptions/schema';
import type { Tenant } from '@/lib/tenants/schema';

const MISSING_CUSTOMER = 'subscription references a missing customer';

type Work = (tx: Database, subscription: Subscription, customer: Customer) => Promise<CommandResult>;

export const withTenantSubscription = (
  db: Database,
  tenant: Tenant,
  subscriptionId: Subscription['subscriptionId'],
  work: Work,
): Promise<CommandResult> =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, subscriptionId);
    if (subscription?.tenantId !== tenant.tenantId) return { kind: COMMAND_RESULT.NOT_FOUND };
    const customer = await findCustomer(tx, tenant.tenantId, subscription.customerId);
    if (customer === undefined) throw new Error(MISSING_CUSTOMER);
    return work(tx, subscription, customer);
  });
