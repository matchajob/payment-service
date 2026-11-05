import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import { zPlanUpdate } from '@/lib/plans/schema';
import { BILLING_INTERVAL } from '@/lib/subscriptions/billing-interval';

const NEW_NAME = 'Pro';
const NEW_PRICE_MINOR = 9900;
const UNRECOGNIZED_KEYS = 'unrecognized_keys';

const updateOf = (change: Record<string, unknown>) => zPlanUpdate.safeParse({ planId: randomUUID(), ...change });

describe('zPlanUpdate: a plan keeps its price for life, so renewals never reprice a subscriber (D8, code-review-1 H5)', () => {
  it.each([
    ['amountMinor', { amountMinor: NEW_PRICE_MINOR }],
    ['currency', { currency: CURRENCY.USD }],
    ['interval', { interval: Object.values(BILLING_INTERVAL)[0] }],
  ])('refuses a change to %s; a new price is a new plan', (field, change) => {
    expect(updateOf(change).error?.issues).toEqual([
      expect.objectContaining({ code: UNRECOGNIZED_KEYS, keys: [field] }),
    ]);
  });

  it('still allows a rename, which changes no money', () => {
    expect(updateOf({ name: NEW_NAME }).success).toBe(true);
  });
});
