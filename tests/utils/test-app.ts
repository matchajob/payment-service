import { createApp, type AppDeps } from '@/api/app';
import type { Database } from '@/lib/db';
import { fakeClock } from '@tests/utils/fake-clock';
import { fakePaymentProvider } from '@tests/utils/fake-payment-provider';
import { silentLogger } from '@tests/utils/silent-logger';

export const TEST_NOW = new Date('2026-01-15T10:00:00.000Z');
export const TEST_CRON_SECRET = 'test-cron-secret';

export const testApp = (db: Database, overrides: Partial<Omit<AppDeps, 'db'>> = {}) =>
  createApp({
    logger: silentLogger,
    clock: fakeClock(TEST_NOW),
    cronSecret: TEST_CRON_SECRET,
    provider: fakePaymentProvider(),
    db,
    ...overrides,
  });
