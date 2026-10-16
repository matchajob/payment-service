import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { TestProject } from 'vitest/node';
import { createDb } from '@/lib/db';
import { isStaleRunDatabase, RUN_DATABASE_PREFIX, runDatabaseName } from '@tests/setup/run-database-name';
import { TEST_DATABASE_URL } from '@tests/utils/test-database-url';

const MIGRATIONS_FOLDER = 'drizzle';

const urlFor = (databaseName: string): string => {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const dropStaleRunDatabases = async (admin: ReturnType<typeof createDb>, now: Date) => {
  const rows = await admin.$client<{ datname: string }[]>`
    select datname from pg_database where datname like ${`${RUN_DATABASE_PREFIX}%`}
  `;
  const stale = rows.map(({ datname }) => datname).filter((name) => isStaleRunDatabase(name, now));
  await Promise.all(stale.map((name) => admin.$client.unsafe(`drop database if exists "${name}" with (force)`)));
};

export default async (project: TestProject) => {
  const now = new Date();
  const databaseName = runDatabaseName(now);
  const admin = createDb(TEST_DATABASE_URL);
  await dropStaleRunDatabases(admin, now);
  await admin.$client.unsafe(`create database "${databaseName}"`);

  const url = urlFor(databaseName);
  const runDb = createDb(url);
  await migrate(runDb, { migrationsFolder: MIGRATIONS_FOLDER });
  await runDb.$client.end();
  project.provide('testDatabaseUrl', url);

  return async () => {
    await admin.$client.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin.$client.end();
  };
};
