import { sql, type AnyColumn, type SQL, type SQLWrapper } from 'drizzle-orm';

// The cursor's keys stay in SQL: a round trip through Date would drop Postgres's microseconds and skip or repeat rows.
export const keysetBefore = (keys: readonly AnyColumn[], cursorKeys: SQLWrapper): SQL =>
  sql`(${sql.join([...keys], sql`, `)}) < (${cursorKeys})`;
