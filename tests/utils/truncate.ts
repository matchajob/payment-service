import { sql } from 'drizzle-orm';
import type { Database } from '@/lib/db';

const APP_TABLES = sql`select tablename from pg_tables where schemaname = 'public'`;

export const truncateAll = async (db: Database): Promise<void> => {
  const rows = await db.execute<{ tablename: string }>(APP_TABLES);
  if (rows.length === 0) return;
  const tables = rows.map(({ tablename }) => `"${tablename}"`).join(', ');
  await db.execute(sql.raw(`truncate ${tables} restart identity cascade`));
};
