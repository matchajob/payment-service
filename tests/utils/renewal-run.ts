import type { Database } from '@/lib/db';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { RENEWAL_BATCH_LIMIT } from '@/lib/renewal/renewal-batch-limit';
import { runRenewal } from '@/lib/renewal/run-renewal';
import { silentLogger } from '@tests/utils/silent-logger';

export const renewWith =
  (db: Database, providerFor: ProviderFor, batchLimit: number = RENEWAL_BATCH_LIMIT) =>
  (now: Date) =>
    runRenewal({ db, providerFor, batchLimit, logger: silentLogger }, now);
