import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import { DUNNING_BATCH_LIMIT } from '@/lib/dunning/dunning-batch-limit';
import { runDunning } from '@/lib/dunning/run-dunning';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { silentLogger } from '@tests/utils/silent-logger';
import { NEVER_TIME_UP } from '@tests/utils/time-up-fixtures';

export const dunWith =
  (db: Database, providerFor: ProviderFor, batchLimit: number = DUNNING_BATCH_LIMIT, timeUp: TimeUp = NEVER_TIME_UP) =>
  (now: Date) =>
    runDunning({ db, providerFor, batchLimit, timeUp, logger: silentLogger }, now);
