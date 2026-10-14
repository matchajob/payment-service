import { createDb, type Db } from '@/lib/db';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const ROLLBACK = Symbol('rollback');

export const testDb = (): Db => {
  const url = process.env['DATABASE_URL'];
  if (url === undefined) throw new Error('DATABASE_URL is not set; is this the integration project?');
  return createDb(url);
};

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
