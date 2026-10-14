import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolveDbProvider } from '@matcha/infra/postgres/resolve';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

export const createDb = (url: string) => {
  const provider = resolveDbProvider(url);
  return drizzle(postgres(provider.url(url), provider.config(url)));
};

export type Db = ReturnType<typeof createDb>;

export type Database = PgDatabase<PostgresJsQueryResultHKT>;
