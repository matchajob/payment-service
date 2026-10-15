import { DrizzleQueryError } from 'drizzle-orm/errors';

const UNIQUE_VIOLATION = '23505';

export const isUniqueViolation = (error: unknown, constraint: string): boolean => {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === UNIQUE_VIOLATION &&
    'constraint_name' in cause &&
    cause.constraint_name === constraint
  );
};
