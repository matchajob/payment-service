import type { InvoiceRequest, Invoicer, IssuedInvoice } from '@/lib/invoicing/invoicer';
import { INVOICER_BEHAVIOUR, type InvoicerBehaviour } from '@tests/utils/fake-invoicer-behaviour';

const INVOICE_REF_PREFIX = 'invoice-';
const DOCUMENT_HOST = 'https://invoices.example/';
const RESPONSE_LOST = 'invoicing service did not answer';

export type FakeInvoicer = Invoicer & {
  calls: { issue: InvoiceRequest[]; findIssued: string[] };
  issued: () => IssuedInvoice[];
  failNextIssue: () => void;
  loseNextResponse: () => void;
};

export const fakeInvoicer = (): FakeInvoicer => {
  const issued = new Map<string, IssuedInvoice>();
  const script: InvoicerBehaviour[] = [];
  const calls: FakeInvoicer['calls'] = { issue: [], findIssued: [] };

  const store = (reference: string): IssuedInvoice => {
    const invoice = {
      invoiceRef: `${INVOICE_REF_PREFIX}${issued.size + 1}`,
      documentUrl: `${DOCUMENT_HOST}${reference}`,
    };
    issued.set(reference, invoice);
    return invoice;
  };

  return {
    calls,
    issued: () => [...issued.values()],
    failNextIssue: () => script.push(INVOICER_BEHAVIOUR.FAIL),
    loseNextResponse: () => script.push(INVOICER_BEHAVIOUR.LOSE_RESPONSE),
    issue: async (request) => {
      calls.issue.push(request);
      const behaviour = script.shift() ?? INVOICER_BEHAVIOUR.ISSUE;
      if (behaviour === INVOICER_BEHAVIOUR.FAIL) throw new Error(RESPONSE_LOST);
      const invoice = store(request.reference);
      if (behaviour === INVOICER_BEHAVIOUR.LOSE_RESPONSE) throw new Error(RESPONSE_LOST);
      return invoice;
    },
    findIssued: async (reference) => {
      calls.findIssued.push(reference);
      return issued.get(reference);
    },
  };
};
