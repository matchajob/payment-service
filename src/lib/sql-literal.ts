import { sql } from 'drizzle-orm';

export const sqlLiteral = (value: string) => sql.raw(`'${value}'`);
