import { createApp, type AppDeps } from '@/api/app';
import type { Database } from '@/lib/db';
import { fakeClock } from '@tests/utils/fake-clock';
import { fakeCronTokenVerifier } from '@tests/utils/fake-cron-token-verifier';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { silentLogger } from '@tests/utils/silent-logger';

export const TEST_NOW = new Date('2026-01-15T10:00:00.000Z');

export const testApp = (db: Database, overrides: Partial<Omit<AppDeps, 'db'>> = {}) =>
  createApp({
    logger: silentLogger,
    clock: fakeClock(TEST_NOW),
    verifyCronToken: fakeCronTokenVerifier,
    providerFor: fakeProviderFactory().providerFor,
    invoicerFor: fakeInvoicerFactory().invoicerFor,
    db,
    ...overrides,
  });
