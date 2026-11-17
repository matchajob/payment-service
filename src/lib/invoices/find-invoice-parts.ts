import { eq } from 'drizzle-orm';
import { chargesTable } from '@/lib/charges/schema';
import { customersTable } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import type { Invoice } from '@/lib/invoices/schema';
import type { InvoiceRequest } from '@/lib/invoicing/invoicer';
import { invoicingConnectionsTable, type InvoicingConnection } from '@/lib/invoicing-connections/schema';
import { plansTable } from '@/lib/plans/schema';
import { subscriptionsTable } from '@/lib/subscriptions/schema';

const MISSING_PARTS = 'invoice references a missing charge, subscription, customer, plan or connection';
const UNPAID_CHARGE = 'invoice references a charge with no provider charge ref';

export type InvoiceParts = { request: InvoiceRequest; connection: InvoicingConnection };

export const findInvoiceParts = async (
  db: Database,
  { invoiceId, chargeId, invoicingConnectionId }: Invoice,
): Promise<InvoiceParts> => {
  const [row] = await db
    .select({
      charge: chargesTable,
      customer: customersTable,
      planName: plansTable.name,
      connection: invoicingConnectionsTable,
    })
    .from(chargesTable)
    .innerJoin(subscriptionsTable, eq(subscriptionsTable.subscriptionId, chargesTable.subscriptionId))
    .innerJoin(customersTable, eq(customersTable.customerId, subscriptionsTable.customerId))
    .innerJoin(plansTable, eq(plansTable.planId, subscriptionsTable.planId))
    .innerJoin(invoicingConnectionsTable, eq(invoicingConnectionsTable.invoicingConnectionId, invoicingConnectionId))
    .where(eq(chargesTable.chargeId, chargeId));
  if (row === undefined) throw new Error(MISSING_PARTS);
  const { charge, customer, planName, connection } = row;
  if (charge.providerChargeRef === null) throw new Error(UNPAID_CHARGE);
  return {
    connection,
    request: {
      reference: invoiceId,
      issuedAt: charge.attemptedAt,
      amountMinor: charge.amountMinor,
      currency: charge.currency,
      description: planName,
      customer: { name: customer.name, email: customer.email, taxId: customer.taxId },
      providerChargeRef: charge.providerChargeRef,
    },
  };
};
