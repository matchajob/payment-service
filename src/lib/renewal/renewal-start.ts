import type { Charge } from '@/lib/charges/schema';
import type { Customer } from '@/lib/customers/schema';
import type { Plan } from '@/lib/plans/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const RENEWAL_START = { SKIPPED: 'skipped', CANCELED: 'canceled', CHARGE: 'charge' } as const;

export type RenewalParties = { tenant: Tenant; customer: Customer; plan: Plan };

export type RenewalStart =
  | { kind: typeof RENEWAL_START.SKIPPED }
  | { kind: typeof RENEWAL_START.CANCELED }
  | { kind: typeof RENEWAL_START.CHARGE; charge: Charge; paymentMethodToken: string; parties: RenewalParties };
