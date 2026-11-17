import type { BuildInvoicer, BuildInvoicerInput, InvoicerFor } from '@/lib/invoicing-connections/invoicer-for';
import type { InvoicingConnection } from '@/lib/invoicing-connections/schema';
import { fakeInvoicer, type FakeInvoicer } from '@tests/utils/fake-invoicer';

type ConnectionId = InvoicingConnection['invoicingConnectionId'];

export type FakeInvoicerFactory = {
  buildInvoicer: BuildInvoicer;
  invoicerFor: InvoicerFor;
  invoicerOf: (invoicingConnectionId: ConnectionId) => FakeInvoicer;
  built: BuildInvoicerInput[];
};

export const fakeInvoicerFactory = (): FakeInvoicerFactory => {
  const invoicers = new Map<ConnectionId, FakeInvoicer>();
  const built: BuildInvoicerInput[] = [];

  const invoicerOf = (invoicingConnectionId: ConnectionId): FakeInvoicer => {
    const existing = invoicers.get(invoicingConnectionId);
    if (existing !== undefined) return existing;
    const invoicer = fakeInvoicer();
    invoicers.set(invoicingConnectionId, invoicer);
    return invoicer;
  };

  return {
    built,
    invoicerOf,
    buildInvoicer: (input) => {
      built.push(input);
      return invoicerOf(input.invoicingConnectionId);
    },
    invoicerFor: async ({ invoicingConnectionId }) => invoicerOf(invoicingConnectionId),
  };
};
