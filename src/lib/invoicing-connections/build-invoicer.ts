import type { BuildInvoicer } from '@/lib/invoicing-connections/invoicer-for';

export const INVOICING_ADAPTER_PENDING = 'no adapter is built for this invoicing service yet';

export const buildInvoicerFrom = (): BuildInvoicer => () => {
  throw new Error(INVOICING_ADAPTER_PENDING);
};
