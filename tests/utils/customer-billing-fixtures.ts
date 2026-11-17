export const BILLING_DETAILS = {
  name: 'Acme Customer Ltd',
  email: 'billing@customer.example',
  taxId: '515000000',
} as const;

export const NO_BILLING_DETAILS = { name: null, email: null, taxId: null } as const;
