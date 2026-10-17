import { describe, expect, it } from 'vitest';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/contract/event-signature';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { verifyAndParseEvent } from '@sdk/verify-and-parse-event';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

describe('SDK verifies what the server really delivers (ADR 0015)', () => {
  const db = truncateModeDb();

  it('accepts the event the drainer sent, with the tenant webhook secret', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const queued = await queueEvent(db, receiver);
    await drainOutbox(db, OCCURRED_AT);
    const [delivery] = endpoint.deliveries;

    const event = await verifyAndParseEvent(
      delivery?.body ?? '',
      {
        [TIMESTAMP_HEADER]: delivery?.header(TIMESTAMP_HEADER),
        [SIGNATURE_HEADER]: delivery?.header(SIGNATURE_HEADER),
      },
      receiver.webhookSecret,
      OCCURRED_AT,
    );

    expect(event.eventId).toBe(queued.outboxEventId);
  });
});
