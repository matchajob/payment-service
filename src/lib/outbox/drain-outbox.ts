import type { CronSummary } from '@/lib/cron/cron-summary';
import type { Database } from '@/lib/db';
import { claimDueEvents } from '@/lib/outbox/claim-due-events';
import { deadLetterExpiredLeases } from '@/lib/outbox/dead-letter-expired-leases';
import { deliverEvent } from '@/lib/outbox/deliver-event';
import { DELIVERY_TIMEOUT_MS } from '@/lib/outbox/delivery-timing';
import { recordDeliveryResult } from '@/lib/outbox/record-delivery-result';
import { findDeliveryTargets } from '@/lib/tenants/find-delivery-targets';

export const drainOutbox = async (db: Database, now: Date, timeoutMs = DELIVERY_TIMEOUT_MS): Promise<CronSummary> => {
  const expired = await deadLetterExpiredLeases(db, now);
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
      await recordDeliveryResult(db, event, result, now);
      return result;
    }),
  );
  const delivered = results.filter(({ delivered }) => delivered).length;
  return { processed: delivered, failed: results.length - delivered + expired };
};
