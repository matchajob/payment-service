import { randomBytes } from 'node:crypto';

const PREFIX = 'payment_service_test_run_';
const SEPARATOR = '_';
const SUFFIX_BYTES = 4;
const SUFFIX_ENCODING = 'hex';
const STALE_AFTER_MS = 60 * 60 * 1000;

export const runDatabaseName = (now: Date): string =>
  `${PREFIX}${now.getTime()}${SEPARATOR}${randomBytes(SUFFIX_BYTES).toString(SUFFIX_ENCODING)}`;

export const isStaleRunDatabase = (name: string, now: Date): boolean => {
  if (!name.startsWith(PREFIX)) return false;
  const createdAt = Number(name.slice(PREFIX.length).split(SEPARATOR)[0]);
  return Number.isFinite(createdAt) && now.getTime() - createdAt > STALE_AFTER_MS;
};

export const RUN_DATABASE_PREFIX = PREFIX;
