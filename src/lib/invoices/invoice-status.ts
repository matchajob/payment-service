export const INVOICE_STATUS = { PENDING: 'pending', ISSUED: 'issued', DEAD: 'dead' } as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];
