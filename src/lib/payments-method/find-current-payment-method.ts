import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { paymentMethodsTable, type PaymentMethod } from '@/lib/payments-method/schema';

export const findCurrentPaymentMethod = async (
  tx: Database,
  subscriptionId: PaymentMethod['subscriptionId'],
): Promise<PaymentMethod | undefined> => {
  const [card] = await tx
    .select()
    .from(paymentMethodsTable)
    .where(and(eq(paymentMethodsTable.subscriptionId, subscriptionId), isNull(paymentMethodsTable.replacedAt)))
    .limit(1);
  return card;
};
