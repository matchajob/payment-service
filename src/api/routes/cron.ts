import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { AppEnv } from '@/api/app-env';
import { cronSummaryResponse } from '@/api/cron-summary-response';
import type { Clock } from '@/lib/clock';
import type { Database } from '@/lib/db';
import { cronTimeBudget } from '@/lib/cron/cron-time-budget';
import { runIdempotencyPurge } from '@/lib/idempotency/run-idempotency-purge';
import { issueInvoices } from '@/lib/invoices/issue-invoices';
import type { InvoicerFor } from '@/lib/invoicing-connections/invoicer-for';
import { DELIVERY_TIMEOUT_MS } from '@/lib/outbox/delivery-timing';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { RENEWAL_BATCH_LIMIT } from '@/lib/renewal/renewal-batch-limit';
import { runRenewal } from '@/lib/renewal/run-renewal';
import { DUNNING_BATCH_LIMIT } from '@/lib/dunning/dunning-batch-limit';
import { runDunning } from '@/lib/dunning/run-dunning';
import { HOUSEKEEPING_BATCH_LIMIT } from '@/lib/housekeeping/housekeeping-batch-limit';
import { runHousekeeping } from '@/lib/housekeeping/run-housekeeping';
import { RECONCILE_BATCH_LIMIT } from '@/lib/reconcile/reconcile-batch-limit';
import { runReconcile } from '@/lib/reconcile/run-reconcile';

export type CronRouteDeps = { clock: Clock; providerFor: ProviderFor; invoicerFor: InvoicerFor; logger: Logger };

export const cronRoutes = ({ clock, providerFor, invoicerFor, logger }: CronRouteDeps) => {
  const runDeps = (db: Database, batchLimit: number) => ({
    db,
    providerFor,
    batchLimit,
    timeUp: cronTimeBudget(clock),
    logger,
  });
  return new Hono<AppEnv>()
    .post('/purge-idempotency', async (c) => c.json(await runIdempotencyPurge(c.get('db'), clock.now())))
    .post('/drain-outbox', async (c) =>
      c.json(await drainOutbox({ db: c.get('db'), logger, timeoutMs: DELIVERY_TIMEOUT_MS }, clock.now())),
    )
    .post('/issue-invoices', async (c) =>
      c.json(await issueInvoices({ db: c.get('db'), invoicerFor, logger, timeUp: cronTimeBudget(clock) }, clock.now())),
    )
    .post('/renew', async (c) =>
      cronSummaryResponse(c, await runRenewal(runDeps(c.get('db'), RENEWAL_BATCH_LIMIT), clock.now())),
    )
    .post('/dun', async (c) =>
      cronSummaryResponse(c, await runDunning(runDeps(c.get('db'), DUNNING_BATCH_LIMIT), clock.now())),
    )
    .post('/housekeeping', async (c) =>
      cronSummaryResponse(c, await runHousekeeping(runDeps(c.get('db'), HOUSEKEEPING_BATCH_LIMIT), clock.now())),
    )
    .post('/reconcile', async (c) =>
      cronSummaryResponse(c, await runReconcile(runDeps(c.get('db'), RECONCILE_BATCH_LIMIT), clock.now())),
    );
};
