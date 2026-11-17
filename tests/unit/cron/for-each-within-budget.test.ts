import { describe, expect, it } from 'vitest';
import { CRON_BUDGET_SPENT, forEachWithinBudget } from '@/lib/cron/for-each-within-budget';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { NEVER_TIME_UP } from '@tests/utils/time-up-fixtures';

const ITEMS = ['a', 'b', 'c'] as const;
const PINO_WARN = 40;

const run = async (timeUpAfter: number) => {
  const log = capturingLogger();
  const done: string[] = [];
  const timeUp = () => done.length >= timeUpAfter;
  await forEachWithinBudget({ timeUp, logger: log.logger }, ITEMS, async (item) => {
    done.push(item);
  });
  return { done, lines: log.lines() };
};

describe('forEachWithinBudget (code-review-1 M11)', () => {
  it('works through every item, in order, while there is time and logs nothing', async () => {
    const log = capturingLogger();
    const done: string[] = [];
    await forEachWithinBudget({ timeUp: NEVER_TIME_UP, logger: log.logger }, ITEMS, async (item) => {
      done.push(item);
    });
    expect(done).toEqual([...ITEMS]);
    expect(log.lines()).toEqual([]);
  });

  it('starts no new item once time is up, so the request ends before Cloud Run cuts it off', async () => {
    const { done } = await run(1);
    expect(done).toEqual(ITEMS.slice(0, 1));
  });

  it('warns how many items it left for the next run, so a backlog that never clears is visible', async () => {
    const { lines } = await run(1);
    expect(lines).toEqual([expect.objectContaining({ level: PINO_WARN, msg: CRON_BUDGET_SPENT, remaining: 2 })]);
  });

  it('does not warn when time runs out just as the last item finishes', async () => {
    const { done, lines } = await run(ITEMS.length);
    expect(done).toEqual([...ITEMS]);
    expect(lines).toEqual([]);
  });
});
