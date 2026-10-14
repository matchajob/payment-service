import { integer, pgTable } from 'drizzle-orm/pg-core';

export const loopProbe = pgTable('loop_probe', { id: integer('id').primaryKey() });
