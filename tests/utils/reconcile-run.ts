import type { Logger } from 'pino';
import type { Database } from '@/lib/db';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { RECONCILE_BATCH_LIMIT } from '@/lib/reconcile/reconcile-batch-limit';
import { runReconcile } from '@/lib/reconcile/run-reconcile';
import { silentLogger } from '@tests/utils/silent-logger';

export const reconcileWith =
  (db: Database, providerFor: ProviderFor, logger: Logger = silentLogger, batchLimit: number = RECONCILE_BATCH_LIMIT) =>
  (now: Date) =>
    runReconcile({ db, providerFor, batchLimit, logger }, now);
