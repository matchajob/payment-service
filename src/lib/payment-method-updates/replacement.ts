import type { CycleParties } from '@/lib/charge-cycle/charge-cycle';
import type { Charge } from '@/lib/charges/schema';

export const REPLACEMENT = { IGNORED: 'ignored', REPLACED: 'replaced', RETRY: 'retry' } as const;

export type Replacement =
  | { kind: typeof REPLACEMENT.IGNORED }
  | { kind: typeof REPLACEMENT.REPLACED }
  | { kind: typeof REPLACEMENT.RETRY; charge: Charge; parties: CycleParties };
