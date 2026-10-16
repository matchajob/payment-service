import type { Database } from '@/lib/db';
import { DUNNING_BATCH_LIMIT } from '@/lib/dunning/dunning-batch-limit';
import { runDunning } from '@/lib/dunning/run-dunning';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { silentLogger } from '@tests/utils/silent-logger';

export const dunWith =
  (db: Database, providerFor: ProviderFor, batchLimit: number = DUNNING_BATCH_LIMIT) =>
  (now: Date) =>
    runDunning({ db, providerFor, batchLimit, logger: silentLogger }, now);
