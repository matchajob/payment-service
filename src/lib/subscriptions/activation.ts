import type { Charge } from '@/lib/charges/schema';

export const ACTIVATION = {
  ACTIVATED: 'activated',
  RACED: 'raced',
  ALREADY_SUBSCRIBED: 'already_subscribed',
} as const;

export type Activation =
  | { kind: typeof ACTIVATION.ACTIVATED; charge: Charge }
  | { kind: typeof ACTIVATION.RACED }
  | { kind: typeof ACTIVATION.ALREADY_SUBSCRIBED };
