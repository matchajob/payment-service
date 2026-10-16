import type { Charge } from '@/lib/charges/schema';
import type { Plan } from '@/lib/plans/schema';
import { advancePeriod } from '@/lib/subscriptions/period';
import type { Subscription } from '@/lib/subscriptions/schema';

const NO_ANCHOR = 'charged subscription has no anchor day';

export const nextPeriodEnd = (
  { anchorDay }: Pick<Subscription, 'anchorDay'>,
  { periodEnd }: Pick<Charge, 'periodEnd'>,
  { interval }: Pick<Plan, 'interval'>,
): Date => {
  if (anchorDay === null) throw new Error(NO_ANCHOR);
  return advancePeriod(periodEnd, anchorDay, interval);
};
