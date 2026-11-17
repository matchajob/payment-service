import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import { HOUSEKEEPING_BATCH_LIMIT } from '@/lib/housekeeping/housekeeping-batch-limit';
import { runHousekeeping } from '@/lib/housekeeping/run-housekeeping';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { silentLogger } from '@tests/utils/silent-logger';
import { NEVER_TIME_UP } from '@tests/utils/time-up-fixtures';

export const housekeepWith =
  (
    db: Database,
    batchLimit: number = HOUSEKEEPING_BATCH_LIMIT,
    providerFor: ProviderFor = fakeProviderFactory().providerFor,
    timeUp: TimeUp = NEVER_TIME_UP,
  ) =>
  (now: Date) =>
    runHousekeeping({ db, providerFor, batchLimit, timeUp, logger: silentLogger }, now);
