import type { Charge } from '@/lib/charges/schema';
import type { CycleParties } from '@/lib/charge-cycle/charge-cycle';

export const CYCLE_START = { SKIPPED: 'skipped', CANCELED: 'canceled', CHARGE: 'charge' } as const;

export type CycleStart =
  | { kind: typeof CYCLE_START.SKIPPED }
  | { kind: typeof CYCLE_START.CANCELED }
  | { kind: typeof CYCLE_START.CHARGE; charge: Charge; paymentMethodToken: string; parties: CycleParties };
