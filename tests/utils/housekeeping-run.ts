import type { Database } from '@/lib/db';
import { HOUSEKEEPING_BATCH_LIMIT } from '@/lib/housekeeping/housekeeping-batch-limit';
import { runHousekeeping } from '@/lib/housekeeping/run-housekeeping';
import { silentLogger } from '@tests/utils/silent-logger';

export const housekeepWith =
  (db: Database, batchLimit: number = HOUSEKEEPING_BATCH_LIMIT) =>
  (now: Date) =>
    runHousekeeping({ db, batchLimit, logger: silentLogger }, now);
