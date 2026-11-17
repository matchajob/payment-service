export const INVOICING_SERVICE = { MORNING: 'morning' } as const;

export type InvoicingServiceName = (typeof INVOICING_SERVICE)[keyof typeof INVOICING_SERVICE];
