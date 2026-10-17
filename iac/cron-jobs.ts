export type CronJob = { name: string; path: string; schedule: string; retryCount: number };

const EVERY_MINUTE = '* * * * *';
const DAILY_AT_0300 = '0 3 * * *';
const HOURLY = '0 * * * *';
const NO_RETRY = 0;
const DAILY_RETRIES = 3;

export const CRON_JOBS: readonly CronJob[] = [
  // The next tick is the retry: a minute-cadence job retried by Scheduler would overlap its own next run.
  { name: 'drain-outbox', path: '/internal/cron/drain-outbox', schedule: EVERY_MINUTE, retryCount: NO_RETRY },
  {
    name: 'purge-idempotency',
    path: '/internal/cron/purge-idempotency',
    schedule: DAILY_AT_0300,
    retryCount: DAILY_RETRIES,
  },
  { name: 'renew', path: '/internal/cron/renew', schedule: HOURLY, retryCount: NO_RETRY },
  { name: 'dun', path: '/internal/cron/dun', schedule: HOURLY, retryCount: NO_RETRY },
  { name: 'housekeeping', path: '/internal/cron/housekeeping', schedule: HOURLY, retryCount: NO_RETRY },
  { name: 'reconcile', path: '/internal/cron/reconcile', schedule: HOURLY, retryCount: NO_RETRY },
];
