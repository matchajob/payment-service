import { asc, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import { paymentMethodUpdatesTable } from '@/lib/payment-method-updates/schema';
import type { Subscription } from '@/lib/subscriptions/schema';

type SubscriptionId = Subscription['subscriptionId'];

export const paymentMethodsOf = (db: Database, subscriptionId: SubscriptionId) =>
  db
    .select()
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.subscriptionId, subscriptionId))
    .orderBy(asc(paymentMethodsTable.replacedAt));

export const paymentMethodUpdatesOf = (db: Database, subscriptionId: SubscriptionId) =>
  db
    .select()
    .from(paymentMethodUpdatesTable)
    .where(eq(paymentMethodUpdatesTable.subscriptionId, subscriptionId))
    .orderBy(asc(paymentMethodUpdatesTable.requestedAt));
