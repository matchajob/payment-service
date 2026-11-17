import type { Logger } from 'pino';
import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { RECONCILE_BATCH_LIMIT } from '@/lib/reconcile/reconcile-batch-limit';
import { runReconcile } from '@/lib/reconcile/run-reconcile';
import { silentLogger } from '@tests/utils/silent-logger';
import { NEVER_TIME_UP } from '@tests/utils/time-up-fixtures';

export const reconcileWith =
  (
    db: Database,
    providerFor: ProviderFor,
    logger: Logger = silentLogger,
    batchLimit: number = RECONCILE_BATCH_LIMIT,
    timeUp: TimeUp = NEVER_TIME_UP,
  ) =>
  (now: Date) =>
    runReconcile({ db, providerFor, batchLimit, timeUp, logger }, now);
