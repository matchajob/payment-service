import type { Customer } from '@/lib/customers/schema';
import type { Subscription } from '@/lib/subscriptions/schema';
import type { RejectionReason } from '@/lib/subscriptions/state-machine/rejection-reason';

export const COMMAND_RESULT = {
  DONE: 'done',
  NOT_FOUND: 'not_found',
  REJECTED: 'rejected',
  CHARGE_IN_FLIGHT: 'charge_in_flight',
} as const;

export type CommandResult =
  | { kind: typeof COMMAND_RESULT.DONE; subscription: Subscription; customer: Customer }
  | { kind: typeof COMMAND_RESULT.NOT_FOUND }
  | { kind: typeof COMMAND_RESULT.REJECTED; reason: RejectionReason }
  | { kind: typeof COMMAND_RESULT.CHARGE_IN_FLIGHT };
