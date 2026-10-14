import { CURRENCY } from '@/lib/money/currency';
import type { CreatePlanInput } from '@/lib/plans/create-plan';
import { BILLING_INTERVAL } from '@/lib/subscriptions/billing-interval';

type PlanFixture = Omit<CreatePlanInput, 'tenantId'>;

export const MONTHLY: PlanFixture = {
  name: 'Pro monthly',
  amountMinor: 4900,
  currency: CURRENCY.ILS,
  interval: BILLING_INTERVAL.MONTH,
};

export const YEARLY: PlanFixture = {
  name: 'Pro yearly',
  amountMinor: 49000,
  currency: CURRENCY.ILS,
  interval: BILLING_INTERVAL.YEAR,
};
