import { INVOICE_RETRY_DELAYS_MS } from '@/lib/invoices/invoice-retry-delays';

export const MAX_INVOICE_ATTEMPTS = INVOICE_RETRY_DELAYS_MS.length + 1;

export const invoiceRetryDelayAfter = (failedAttempts: number): number | undefined =>
  INVOICE_RETRY_DELAYS_MS[failedAttempts - 1];
