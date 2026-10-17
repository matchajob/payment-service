import { createCustomer, CREATE_CUSTOMER_OUTCOME } from '@/lib/customers/create-customer';
import type { Database } from '@/lib/db';
import type { PaymentMethod } from '@/lib/payments-method/schema';
import type { Subscription } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { seedBillingContext, type BillingContext } from '@tests/utils/billing-context';
import type { SeededConnection } from '@tests/utils/connection-rows';
import { insertPaymentMethod } from '@tests/utils/payment-method-rows';
import { insertSubscription } from '@tests/utils/subscription-rows';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';

type SubscriptionOverrides = NonNullable<Parameters<typeof insertSubscription>[2]>;

export const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');
export const NEXT_PERIOD_END = new Date('2026-03-15T10:00:00.000Z');
export const ANCHOR_DAY = 15;

const EXTERNAL_REF_PREFIX = 'renewing-user-';
const CAPTURE_REF_PREFIX = 'renewal-session-';
const FIRST = 0;

const DUE = { status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: PERIOD_END, anchorDay: ANCHOR_DAY } as const;

export type Renewing = {
  ctx: BillingContext;
  subscription: Subscription;
  cardToken: string;
  paymentMethodId: PaymentMethod['paymentMethodId'];
};

export const addRenewing = async (
  db: Database,
  ctx: BillingContext,
  index: number,
  overrides: SubscriptionOverrides = {},
): Promise<Renewing> => {
  const customer = await createCustomer(db, ctx.tenantId, `${EXTERNAL_REF_PREFIX}${index}`);
  if (customer.outcome !== CREATE_CUSTOMER_OUTCOME.CREATED) throw new Error('renewal customer already existed');
  const [subscription] = await insertSubscription(
    db,
    {
      tenantId: ctx.tenantId,
      customerId: customer.customer.customerId,
      planId: ctx.plan.planId,
      providerConnectionId: ctx.providerConnectionId,
    },
    { ...DUE, ...overrides },
  ).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  const { tenantId, subscriptionId, providerConnectionId } = subscription;
  const [card] = await insertPaymentMethod(
    db,
    { tenantId, subscriptionId, providerConnectionId },
    `${CAPTURE_REF_PREFIX}${index}`,
  ).returning();
  if (card === undefined) throw new Error('payment method insert returned no row');
  return { ctx, subscription, cardToken: card.providerToken, paymentMethodId: card.paymentMethodId };
};

export const seedRenewing = async (
  db: Database,
  overrides: SubscriptionOverrides = {},
  tenant: TenantFixture = ACME,
  connection?: SeededConnection,
): Promise<Renewing> => addRenewing(db, await seedBillingContext(db, tenant, connection), FIRST, overrides);

export const seedRenewings = async (
  db: Database,
  count: number,
  overrides: SubscriptionOverrides = {},
): Promise<{ ctx: BillingContext; renewings: Renewing[] }> => {
  const ctx = await seedBillingContext(db);
  const renewings = await Promise.all(
    Array.from({ length: count }, (_, index) => addRenewing(db, ctx, index, overrides)),
  );
  return { ctx, renewings };
};
