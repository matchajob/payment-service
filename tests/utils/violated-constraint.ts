import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { Database } from '@/lib/db';

const constraintOf = (error: unknown): string | undefined => {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (typeof cause !== 'object' || cause === null || !('constraint_name' in cause)) return undefined;
  return typeof cause.constraint_name === 'string' ? cause.constraint_name : undefined;
};

export const violatedConstraint = async (
  db: Database,
  write: (savepoint: Database) => Promise<unknown>,
): Promise<string | undefined> => {
  try {
    await db.transaction(async (savepoint) => {
      await write(savepoint);
    });
    return undefined;
  } catch (error) {
    const constraint = constraintOf(error);
    if (constraint === undefined) throw error;
    return constraint;
  }
};
