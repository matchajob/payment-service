import { describe, expect, it } from 'vitest';
import { REQUEST_TIMEOUT } from '@iac/request-timeout';
import { CRON_TIME_BUDGET_MS } from '@/lib/cron/cron-time-budget-ms';

const MS_PER_SECOND = 1000;
const SECONDS_SUFFIX = 's';
const SLOWEST_ITEM_MS = 60_000;

describe('cron time budget vs the Cloud Run request timeout (code-review-1 M11)', () => {
  it('leaves room for the slowest single item to finish after the budget is spent', () => {
    expect(REQUEST_TIMEOUT.endsWith(SECONDS_SUFFIX)).toBe(true);
    const requestTimeoutMs = Number.parseInt(REQUEST_TIMEOUT, 10) * MS_PER_SECOND;
    expect(requestTimeoutMs - CRON_TIME_BUDGET_MS).toBeGreaterThanOrEqual(SLOWEST_ITEM_MS);
  });
});
