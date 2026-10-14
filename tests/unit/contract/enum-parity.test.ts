import { describe, expect, it } from 'vitest';
import { publicPlanSchema } from '@/contract/public-plan';
import { CURRENCY } from '@/lib/money/currency';
import { BILLING_INTERVAL } from '@/lib/subscriptions/billing-interval';

const sorted = (values: readonly string[]) => [...values].sort();

describe('contract enums match the server enums', () => {
  it('lists exactly the currencies the server stores', () => {
    expect(sorted(publicPlanSchema.shape.currency.options)).toEqual(sorted(Object.values(CURRENCY)));
  });

  it('lists exactly the billing intervals the server stores', () => {
    expect(sorted(publicPlanSchema.shape.interval.options)).toEqual(sorted(Object.values(BILLING_INTERVAL)));
  });
});
