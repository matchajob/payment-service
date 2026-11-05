import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { paymentMethodUpdatesTable } from '@/lib/payment-method-updates/schema';
import { seedBillingContext, type BillingContext } from '@tests/utils/billing-context';
import { insertCharge } from '@tests/utils/charge-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { insertOutboxEvent } from '@tests/utils/outbox-rows';
import { insertPaymentMethod, type SubscriptionOwner } from '@tests/utils/payment-method-rows';
import { insertSubscription } from '@tests/utils/subscription-rows';
import { GLOBEX } from '@tests/utils/tenant-fixtures';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const SUBSCRIPTION_CUSTOMER = 'subscriptions_customer_same_tenant';
const SUBSCRIPTION_PLAN = 'subscriptions_plan_same_tenant';
const PAYMENT_METHOD_SUBSCRIPTION = 'payment_methods_subscription_same_tenant';
const CHARGE_SUBSCRIPTION = 'charges_subscription_same_tenant';
const CHARGE_CARD = 'charges_card_of_subscription';
const OUTBOX_SUBSCRIPTION = 'outbox_events_subscription_same_tenant';
const UPDATE_SUBSCRIPTION = 'payment_method_updates_subscription_same_tenant';
const FIRST_SEQUENCE = 1;
const SESSION = 'session-1';
const OTHER_SESSION = 'session-2';
const REQUESTED_AT = new Date('2026-02-01T10:00:00.000Z');

const parentsOf = ({ tenantId, customerId, plan, providerConnectionId }: BillingContext) => ({
  tenantId,
  customerId,
  planId: plan.planId,
  providerConnectionId,
});

const subscriptionOf = async (db: Database, ctx: BillingContext): Promise<SubscriptionOwner> => {
  const [subscription] = await insertSubscription(db, parentsOf(ctx)).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  return {
    tenantId: ctx.tenantId,
    subscriptionId: subscription.subscriptionId,
    providerConnectionId: ctx.providerConnectionId,
  };
};

const cardOf = async (db: Database, owner: SubscriptionOwner, captureRef: string) => {
  const [card] = await insertPaymentMethod(db, owner, captureRef).returning();
  if (card === undefined) throw new Error('payment method insert returned no row');
  return card.paymentMethodId;
};

const twoTenantsOnOneConnection = async (db: Database) => {
  const ours = await seedBillingContext(db);
  const theirs = await seedBillingContext(db, GLOBEX, ours);
  return { ours, theirs };
};

describe("tenant integrity: a row can only point at its own tenant's rows (code-review-1 M13)", () => {
  it("rejects a subscription for another tenant's customer", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours, theirs } = await twoTenantsOnOneConnection(tx);
      const write = (db: Database) => insertSubscription(db, { ...parentsOf(ours), customerId: theirs.customerId });
      expect(await violatedConstraint(tx, write)).toBe(SUBSCRIPTION_CUSTOMER);
    });
  });

  it("rejects a subscription on another tenant's plan, whose price is not ours to charge", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours, theirs } = await twoTenantsOnOneConnection(tx);
      const write = (db: Database) => insertSubscription(db, { ...parentsOf(ours), planId: theirs.plan.planId });
      expect(await violatedConstraint(tx, write)).toBe(SUBSCRIPTION_PLAN);
    });
  });

  it("rejects a card saved under our tenant on another tenant's subscription", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours, theirs } = await twoTenantsOnOneConnection(tx);
      const their = await subscriptionOf(tx, theirs);
      const write = (db: Database) => insertPaymentMethod(db, { ...their, tenantId: ours.tenantId }, SESSION);
      expect(await violatedConstraint(tx, write)).toBe(PAYMENT_METHOD_SUBSCRIPTION);
    });
  });

  it("rejects a charge under our tenant on another tenant's subscription", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours, theirs } = await twoTenantsOnOneConnection(tx);
      const their = await subscriptionOf(tx, theirs);
      const paymentMethodId = await cardOf(tx, their, SESSION);
      const write = (db: Database) => insertCharge(db, { ...their, tenantId: ours.tenantId, paymentMethodId });
      expect(await violatedConstraint(tx, write)).toBe(CHARGE_SUBSCRIPTION);
    });
  });

  it("rejects a charge on another subscription's card, even within one tenant", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours } = await twoTenantsOnOneConnection(tx);
      const first = await subscriptionOf(tx, ours);
      const second = await subscriptionOf(tx, ours);
      const secondCard = await cardOf(tx, second, OTHER_SESSION);
      const write = (db: Database) => insertCharge(db, { ...first, paymentMethodId: secondCard });
      expect(await violatedConstraint(tx, write)).toBe(CHARGE_CARD);
    });
  });

  it("rejects an event under our tenant about another tenant's subscription, which would reach the wrong webhook", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours, theirs } = await twoTenantsOnOneConnection(tx);
      const their = await subscriptionOf(tx, theirs);
      const write = (db: Database) => insertOutboxEvent(db, { ...their, tenantId: ours.tenantId }, FIRST_SEQUENCE);
      expect(await violatedConstraint(tx, write)).toBe(OUTBOX_SUBSCRIPTION);
    });
  });

  it("rejects a card update under our tenant on another tenant's subscription", async () => {
    await withRollback(testDb(), async (tx) => {
      const { ours, theirs } = await twoTenantsOnOneConnection(tx);
      const their = await subscriptionOf(tx, theirs);
      const write = (db: Database) =>
        db.insert(paymentMethodUpdatesTable).values({
          ...their,
          tenantId: ours.tenantId,
          sessionRef: SESSION,
          requestedAt: REQUESTED_AT,
          completedAt: null,
        });
      expect(await violatedConstraint(tx, write)).toBe(UPDATE_SUBSCRIPTION);
    });
  });
});
