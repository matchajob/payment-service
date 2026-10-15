import { afterAll, afterEach, beforeEach } from 'vitest';
import type { Db } from '@/lib/db';
import { testDb } from '@tests/utils/db';
import { truncateAll } from '@tests/utils/truncate';

export const truncateModeDb = (): Db => {
  const db = testDb();
  beforeEach(() => truncateAll(db));
  afterEach(() => truncateAll(db));
  afterAll(() => db.$client.end());
  return db;
};
