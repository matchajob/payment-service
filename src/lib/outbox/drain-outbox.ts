import type { Logger } from 'pino';
import type { CronSummary } from '@/lib/cron/cron-summary';
import type { Database } from '@/lib/db';
import { claimDueEvents } from '@/lib/outbox/claim-due-events';
import type { DeadLetter } from '@/lib/outbox/dead-letter';
import { deadLetterExpiredLeases } from '@/lib/outbox/dead-letter-expired-leases';
import { deliverEvent } from '@/lib/outbox/deliver-event';
import { recordDeliveryResult } from '@/lib/outbox/record-delivery-result';
import { findDeliveryTargets } from '@/lib/tenants/find-delivery-targets';

export const OUTBOX_DEAD_LETTERED = 'outbox event dead-lettered; redrive it once the receiver is fixed';

export type DrainOutboxDeps = { db: Database; logger: Pick<Logger, 'error'>; timeoutMs: number };

export const drainOutbox = async ({ db, logger, timeoutMs }: DrainOutboxDeps, now: Date): Promise<CronSummary> => {
  const logDead = (dead: DeadLetter) => logger.error(dead, OUTBOX_DEAD_LETTERED);
  const expired = await deadLetterExpiredLeases(db, now);
  expired.forEach(logDead);
  const claimed = await claimDueEvents(db, now);
  const targets = await findDeliveryTargets(
    db,
    claimed.map(({ tenantId }) => tenantId),
  );
  const results = await Promise.all(
    claimed.map(async (event) => {
      const target = targets.get(event.tenantId);
      if (target === undefined) throw new Error('claimed an outbox event whose tenant does not exist');
      const result = await deliverEvent(target, event, now, timeoutMs);
      const dead = await recordDeliveryResult(db, event, result, now);
      if (dead !== undefined) logDead(dead);
      return result;
    }),
  );
  const delivered = results.filter(({ delivered }) => delivered).length;
  return { processed: delivered, failed: results.length - delivered + expired.length };
};
