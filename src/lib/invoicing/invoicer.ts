import type { Currency } from '@/lib/money/currency';

export type InvoiceCustomer = { name: string | null; email: string | null; taxId: string | null };

export type InvoiceRequest = {
  reference: string;
  issuedAt: Date;
  amountMinor: number;
  currency: Currency;
  description: string;
  customer: InvoiceCustomer;
  providerChargeRef: string;
};

export type IssuedInvoice = { invoiceRef: string; documentUrl: string | null };

export type Invoicer = {
  issue: (request: InvoiceRequest) => Promise<IssuedInvoice>;
  findIssued: (reference: string) => Promise<IssuedInvoice | undefined>;
};
