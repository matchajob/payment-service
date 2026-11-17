import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { RENEWAL_BATCH_LIMIT } from '@/lib/renewal/renewal-batch-limit';
import { runRenewal } from '@/lib/renewal/run-renewal';
import { silentLogger } from '@tests/utils/silent-logger';
import { NEVER_TIME_UP } from '@tests/utils/time-up-fixtures';

export const renewWith =
  (db: Database, providerFor: ProviderFor, batchLimit: number = RENEWAL_BATCH_LIMIT, timeUp: TimeUp = NEVER_TIME_UP) =>
  (now: Date) =>
    runRenewal({ db, providerFor, batchLimit, timeUp, logger: silentLogger }, now);
