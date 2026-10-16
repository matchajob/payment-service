import { describe, expect, it } from 'vitest';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/lib/outbox/delivery-headers';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { signPayload } from '@/lib/outbox/sign-payload';
import { fakeTenantEndpoint, type ReceivedDelivery } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const SERVER_ERROR = 500;

const eventIdOf = ({ body }: ReceivedDelivery) => JSON.parse(body).eventId;
const verifies = (secret: string, delivery: ReceivedDelivery) =>
  delivery.header(SIGNATURE_HEADER) === signPayload(secret, Number(delivery.header(TIMESTAMP_HEADER)), delivery.body);

describe('drainOutbox: tenant isolation (multi-tenant, D12)', () => {
  const db = truncateModeDb();

  it('sends each tenant only its own events, signed with its own secret', async () => {
    const acmeEndpoint = await fakeTenantEndpoint();
    const globexEndpoint = await fakeTenantEndpoint();
    const acme = await seedReceiver(db, receivingAt(acmeEndpoint, ACME));
    const globex = await seedReceiver(db, receivingAt(globexEndpoint, GLOBEX));
    const acmeEvent = await queueEvent(db, acme);
    const globexEvent = await queueEvent(db, globex);
    await drainOutbox(db, NOW);
    expect(acmeEndpoint.deliveries.map(eventIdOf)).toEqual([acmeEvent.outboxEventId]);
    expect(globexEndpoint.deliveries.map(eventIdOf)).toEqual([globexEvent.outboxEventId]);
    expect(acmeEndpoint.deliveries.every((delivery) => verifies(acme.webhookSecret, delivery))).toBe(true);
    expect(globexEndpoint.deliveries.every((delivery) => verifies(globex.webhookSecret, delivery))).toBe(true);
    expect(acmeEndpoint.deliveries.some((delivery) => verifies(globex.webhookSecret, delivery))).toBe(false);
  });

  it('a failing tenant does not hold up another tenant', async () => {
    const acmeEndpoint = await fakeTenantEndpoint();
    const globexEndpoint = await fakeTenantEndpoint();
    acmeEndpoint.reply(SERVER_ERROR);
    const acme = await seedReceiver(db, receivingAt(acmeEndpoint, ACME));
    const globex = await seedReceiver(db, receivingAt(globexEndpoint, GLOBEX));
    const acmeEvent = await queueEvent(db, acme);
    const globexEvent = await queueEvent(db, globex);
    expect(await drainOutbox(db, NOW)).toEqual({ processed: 1, failed: 1 });
    expect(await outboxRow(db, acmeEvent)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.PENDING });
    expect(await outboxRow(db, globexEvent)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.DELIVERED });
  });

  it('a failing event does not hold up later events of the same subscription (rule 4 makes order harmless)', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(SERVER_ERROR);
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const first = await queueEvent(db, receiver, 1);
    const second = await queueEvent(db, receiver, 2, { nextAttemptAt: new Date(NOW.getTime() + 1) });
    await drainOutbox(db, NOW);
    expect(await drainOutbox(db, new Date(NOW.getTime() + 1))).toEqual({ processed: 1, failed: 0 });
    expect(await outboxRow(db, first)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.PENDING });
    expect(await outboxRow(db, second)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.DELIVERED });
  });
});
