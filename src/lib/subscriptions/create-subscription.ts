import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/db';
import { findCustomer } from '@/lib/customers/find-customer';
import type { Customer } from '@/lib/customers/schema';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import type { PaymentProvider } from '@/lib/payments/provider';
import { findPlan } from '@/lib/plans/find-plan';
import type { Plan } from '@/lib/plans/schema';
import { CREATE_SUBSCRIPTION_OUTCOME } from '@/lib/subscriptions/create-subscription-outcome';
import { subscriptionsTable, zSubscriptionRead, type Subscription } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import type { Tenant } from '@/lib/tenants/schema';

export type CreateSubscriptionInput = {
  tenantId: Tenant['tenantId'];
  customerId: Customer['customerId'];
  planId: Plan['planId'];
  returnUrl: string;
};

export type CreateSubscriptionResult =
  | { outcome: typeof CREATE_SUBSCRIPTION_OUTCOME.CREATED; subscription: Subscription; checkoutUrl: string }
  | { outcome: typeof CREATE_SUBSCRIPTION_OUTCOME.CUSTOMER_NOT_FOUND }
  | { outcome: typeof CREATE_SUBSCRIPTION_OUTCOME.PLAN_NOT_FOUND };

export const createSubscription = async (
    db: Database,
    provider: PaymentProvider,
    { tenantId, customerId, planId, returnUrl }: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> => {
    const customer = await findCustomer(db, tenantId, customerId);
    if (customer === undefined) return { outcome: CREATE_SUBSCRIPTION_OUTCOME.CUSTOMER_NOT_FOUND };
    const plan = await findPlan(db, tenantId, planId);
    if (plan === undefined) return { outcome: CREATE_SUBSCRIPTION_OUTCOME.PLAN_NOT_FOUND };

    const subscriptionId = zSubscriptionRead.shape.subscriptionId.parse(randomUUID());
    const session = await provider.startCheckout({
        mode: CHECKOUT_MODE.CHARGE,
        reference: subscriptionId,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        returnUrl,
    });

    const [subscription] = await db
    .insert(subscriptionsTable)
    .values({
      subscriptionId,
      tenantId,
      customerId,
      planId,
      status: SUBSCRIPTION_STATUS.INCOMPLETE,
      scheduleOwner: SCHEDULE_OWNER.SELF,
      checkoutSessionRef: session.providerSessionRef,
    })
    .returning();
    if (subscription === undefined)throw new Error('subscription insert returned no row');
    return { outcome: CREATE_SUBSCRIPTION_OUTCOME.CREATED, subscription, checkoutUrl: session.checkoutUrl };
};