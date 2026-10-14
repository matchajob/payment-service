import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import {
  active,
  canceled,
  flagged,
  incomplete,
  pastDue,
} from '@tests/unit/subscriptions/state-machine/fixtures/states';

export type SpecRow = readonly [label: string, from: SubscriptionState, event: LifecycleEvent, to: SubscriptionState];

export const ROWS: readonly SpecRow[] = [
  ['r2', incomplete, 'checkout_completed', active],
  ['r3', incomplete, 'checkout_expired', canceled],
  ['r4', incomplete, 'cancel', canceled],
  ['r5 trigger', active, 'renewal_due', active],
  ['r5', active, 'renewal_succeeded', active],
  ['r6', active, 'renewal_failed', pastDue],
  ['r7', flagged, 'renewal_due', canceled],
  ['r8', active, 'cancel', flagged],
  ['r8 idempotent', flagged, 'cancel', flagged],
  ['r9', flagged, 'resume', active],
  ['r10', pastDue, 'retry_succeeded', active],
  ['retry fails, not final', pastDue, 'retry_failed', pastDue],
  ['r11', pastDue, 'final_retry_failed', canceled],
  ['r12', pastDue, 'cancel', canceled],
  ['r13', active, 'payment_method_updated', active],
  ['r13 flagged', flagged, 'payment_method_updated', flagged],
  ['r14', pastDue, 'payment_method_updated', pastDue],
  ['r14 retry fails', pastDue, 'immediate_retry_failed', pastDue],
];
