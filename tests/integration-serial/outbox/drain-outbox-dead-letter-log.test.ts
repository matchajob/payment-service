import { describe, expect, it } from 'vitest';
import { DELIVERY_TIMEOUT_MS } from '@/lib/outbox/delivery-timing';
import { drainOutbox, OUTBOX_DEAD_LETTERED } from '@/lib/outbox/drain-outbox';
import { LEASE_EXPIRED_ERROR } from '@/lib/outbox/lease-expired-error';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { PINO_LEVEL } from '@tests/utils/pino-levels';
import { queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const UNAVAILABLE = 503;

describe('drainOutbox: dead letters are loud in the logs (Spec 5 rule 7, D13, code-review-1 M23)', () => {
  const db = truncateModeDb();

  const drain = async () => {
    const log = capturingLogger();
    await drainOutbox({ db, logger: log.logger, timeoutMs: DELIVERY_TIMEOUT_MS }, NOW);
    return log.lines().filter(({ msg }) => msg === OUTBOX_DEAD_LETTERED);
  };

  it('logs an error naming the event, its tenant and the last error when the 8th attempt fails', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(UNAVAILABLE);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver, 1, { attempts: MAX_DELIVERY_ATTEMPTS - 1 });

    expect(await drain()).toEqual([
      expect.objectContaining({
        level: PINO_LEVEL.ERROR,
        outboxEventId: event.outboxEventId,
        tenantId: event.tenantId,
        eventType: event.eventType,
        lastError: `HTTP ${UNAVAILABLE}`,
      }),
    ]);
  });

  it('logs an error when an 8th attempt dead-letters on an expired lease', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const event = await queueEvent(db, receiver, 1, { attempts: MAX_DELIVERY_ATTEMPTS });

    expect(await drain()).toEqual([
      expect.objectContaining({
        level: PINO_LEVEL.ERROR,
        outboxEventId: event.outboxEventId,
        tenantId: event.tenantId,
        lastError: LEASE_EXPIRED_ERROR,
      }),
    ]);
  });

  it('logs nothing for a failure that will be retried', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(UNAVAILABLE);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    await queueEvent(db, receiver);

    expect(await drain()).toEqual([]);
  });
});
