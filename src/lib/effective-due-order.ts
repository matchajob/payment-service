import { asc, sql, type AnyColumn } from 'drizzle-orm';

export const effectiveDueOrder = (dueAt: AnyColumn, deferredAt: AnyColumn) =>
  asc(sql`greatest(${dueAt}, ${deferredAt})`);
