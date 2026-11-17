import type { Clock } from '@/lib/clock';
import { CRON_TIME_BUDGET_MS } from '@/lib/cron/cron-time-budget-ms';
import type { TimeUp } from '@/lib/cron/time-up';

export const cronTimeBudget = (clock: Clock): TimeUp => {
  const deadline = clock.now().getTime() + CRON_TIME_BUDGET_MS;
  return () => clock.now().getTime() >= deadline;
};
