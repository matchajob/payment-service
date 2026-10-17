import { inject } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Db } from '@/lib/db';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const ROLLBACK = Symbol('rollback');

const IDLE_TIMEOUT_SECONDS = 1;

export const testDb = (): Db => drizzle(postgres(inject('testDatabaseUrl'), { idle_timeout: IDLE_TIMEOUT_SECONDS }));

export const withRollback = async (db: Db, fn: (tx: Tx) => Promise<void>): Promise<void> => {
  await db
    .transaction(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((error: unknown) => {
      if (error !== ROLLBACK) throw error;
    });
};
