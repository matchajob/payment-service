import { describe, expect, it } from 'vitest';
import { isEntitled } from '@/lib/subscriptions/is-entitled';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

const { INCOMPLETE, ACTIVE, PAST_DUE, CANCELED } = SUBSCRIPTION_STATUS;
const PAID = true;
const UNPAID = false;

describe('isEntitled (Spec 1 states, D4)', () => {
  it.each([
    [INCOMPLETE, true, false],
    [INCOMPLETE, false, false],
    [ACTIVE, true, true],
    [ACTIVE, false, true],
    [PAST_DUE, true, true],
    [PAST_DUE, false, false],
    [CANCELED, true, false],
    [CANCELED, false, false],
  ])('%s with graceEntitlement %s is entitled: %s once paid', (status, graceEntitlement, expected) => {
    expect(isEntitled(status, graceEntitlement, PAID)).toBe(expected);
  });

  it.each([ACTIVE, PAST_DUE])(
    '%s is never entitled before charge #1 succeeds, whatever the grace policy (code-review-1 M6)',
    (status) => {
      expect(isEntitled(status, true, UNPAID)).toBe(false);
    },
  );
});
