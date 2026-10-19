import type { Plan } from '@/lib/plans/schema';
import { advancePeriod } from '@/lib/subscriptions/period';
import type { Subscription } from '@/lib/subscriptions/schema';

const NO_PERIOD = 'charged subscription has no current period';
const NO_ANCHOR = 'charged subscription has no anchor day';

export const nextPeriodEnd = (
  { currentPeriodEnd, anchorDay }: Pick<Subscription, 'currentPeriodEnd' | 'anchorDay'>,
  { interval }: Pick<Plan, 'interval'>,
): Date => {
  if (currentPeriodEnd === null) throw new Error(NO_PERIOD);
  if (anchorDay === null) throw new Error(NO_ANCHOR);
  return advancePeriod(currentPeriodEnd, anchorDay, interval);
};
