import { describe, expect, it } from 'vitest';
import { eventListResponseSchema } from '@/contract/event-list-response';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { withQuery } from '@tests/utils/list-query';
import { insertOutboxEvent, OCCURRED_AT } from '@tests/utils/outbox-rows';
import { EVENTS_PATH } from '@tests/utils/paths';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const FIRST_SEQUENCE = 1;
const SECOND_SEQUENCE = 2;
const ATTEMPTS_BEFORE_DEAD = 8;
const LAST_ERROR = 'tenant endpoint answered 500';
const UNKNOWN_STATUS = 'lost';

type Page = { data: { eventId: string }[]; hasMore: boolean };

const DEAD = { deliveryStatus: DELIVERY_STATUS.DEAD, attempts: ATTEMPTS_BEFORE_DEAD, lastError: LAST_ERROR } as const;

describe('GET /v1/events (dashboard slice 1)', () => {
  it("lists the calling tenant's events with their delivery state, and nobody else's", async () => {
    await withRollback(testDb(), async (tx) => {
      const theirs = await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      await insertOutboxEvent(tx, theirs.subscription, FIRST_SEQUENCE);
      const [dead] = await insertOutboxEvent(tx, ours.subscription, FIRST_SEQUENCE, DEAD).returning({
        outboxEventId: outboxEventsTable.outboxEventId,
      });
      const res = await testApp(tx).request(EVENTS_PATH, bearer(ours.ctx.apiKey));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(eventListResponseSchema.parse(body)).toEqual(body);
      expect(body).toEqual({
        hasMore: false,
        data: [
          {
            eventId: dead?.outboxEventId,
            subscriptionId: ours.subscription.subscriptionId,
            type: OUTBOUND_EVENT_TYPE.SUBSCRIPTION_ACTIVATED,
            sequence: FIRST_SEQUENCE,
            occurredAt: OCCURRED_AT.toISOString(),
            deliveryStatus: DELIVERY_STATUS.DEAD,
            attempts: ATTEMPTS_BEFORE_DEAD,
            lastError: LAST_ERROR,
          },
        ],
      });
    });
  });

  it('filters by delivery status, so the dashboard can show dead letters only', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx);
      await insertOutboxEvent(tx, subscription, FIRST_SEQUENCE);
      const [dead] = await insertOutboxEvent(tx, subscription, SECOND_SEQUENCE, DEAD).returning({
        outboxEventId: outboxEventsTable.outboxEventId,
      });
      const res = await testApp(tx).request(
        withQuery(EVENTS_PATH, { deliveryStatus: DELIVERY_STATUS.DEAD }),
        bearer(ctx.apiKey),
      );
      const body: Page = await res.json();
      expect(body.data.map((e) => e.eventId)).toEqual([dead?.outboxEventId]);
    });
  });

  it('answers 400 for an unknown delivery status', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx } = await seedRenewing(tx);
      const res = await testApp(tx).request(
        withQuery(EVENTS_PATH, { deliveryStatus: UNKNOWN_STATUS }),
        bearer(ctx.apiKey),
      );
      expect(res.status).toBe(400);
    });
  });
});
