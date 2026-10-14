import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from '@/lib/db';
import { TEST_DATABASE_URL } from '@tests/utils/test-database-url';

const MIGRATIONS_FOLDER = 'drizzle';

export default async () => {
  const db = createDb(TEST_DATABASE_URL);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await db.$client.end();
};
