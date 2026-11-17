import type { Logger } from 'pino';
import type { TimeUp } from '@/lib/cron/time-up';

export const CRON_BUDGET_SPENT = 'cron time budget spent; the rest waits for the next run';

export type WithinBudgetDeps = { timeUp: TimeUp; logger: Pick<Logger, 'warn'> };

export const forEachWithinBudget = async <T>(
  { timeUp, logger }: WithinBudgetDeps,
  items: readonly T[],
  work: (item: T) => Promise<void>,
): Promise<void> => {
  for (const [index, item] of items.entries()) {
    if (timeUp()) {
      logger.warn({ remaining: items.length - index }, CRON_BUDGET_SPENT);
      return;
    }
    await work(item);
  }
};
