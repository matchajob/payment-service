import type { Database } from '@/lib/db';
import { HOUSEKEEPING_BATCH_LIMIT } from '@/lib/housekeeping/housekeeping-batch-limit';
import { runHousekeeping } from '@/lib/housekeeping/run-housekeeping';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { silentLogger } from '@tests/utils/silent-logger';

export const housekeepWith =
  (
    db: Database,
    batchLimit: number = HOUSEKEEPING_BATCH_LIMIT,
    providerFor: ProviderFor = fakeProviderFactory().providerFor,
  ) =>
  (now: Date) =>
    runHousekeeping({ db, providerFor, batchLimit, logger: silentLogger }, now);
