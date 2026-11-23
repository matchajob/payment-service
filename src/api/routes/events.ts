import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { toEventDelivery } from '@/api/to-event-delivery';
import { unknownCursorResponse } from '@/api/unknown-cursor-response';
import { eventListQuerySchema } from '@/contract/event-list-query';
import type { EventListResponse } from '@/contract/event-list-response';
import type { EventResponse } from '@/contract/event-response';
import type { Clock } from '@/lib/clock';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { findEvent } from '@/lib/outbox/find-event';
import { listEvents } from '@/lib/outbox/list-events';
import { redriveDeadLetters } from '@/lib/outbox/redrive-dead-letters';
import { zOutboxEventRead } from '@/lib/outbox/schema';
import { LIST_OUTCOME } from '@/lib/pagination/list-result';

const ID = 'eventId';
const NOT_DEAD = 'only a dead event can be redriven';
const eventIdParam = zOutboxEventRead.shape.outboxEventId;
const listQuery = eventListQuerySchema.extend({ startingAfter: eventIdParam.optional() });

export const eventsRoutes = (clock: Clock) =>
  new Hono<AppEnv>()
    .get('/', async (c) => {
      const query = listQuery.safeParse(c.req.query());
      if (!query.success) return problemResponse(c, HTTP_STATUS.BAD_REQUEST, query.error.message);
      const result = await listEvents(c.get('db'), c.get('tenant').tenantId, query.data);
      if (result.outcome === LIST_OUTCOME.UNKNOWN_CURSOR) return unknownCursorResponse(c);
      const body: EventListResponse = { hasMore: result.hasMore, data: result.items.map(toEventDelivery) };
      return c.json(body);
    })
    .post(`/:${ID}/redrive`, async (c) => {
      const id = eventIdParam.safeParse(c.req.param(ID));
      if (!id.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const db = c.get('db');
      const { tenantId } = c.get('tenant');
      const event = await findEvent(db, tenantId, id.data);
      if (event === undefined) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      if (event.deliveryStatus !== DELIVERY_STATUS.DEAD) return problemResponse(c, HTTP_STATUS.CONFLICT, NOT_DEAD);
      await redriveDeadLetters(db, { outboxEventId: event.outboxEventId }, clock.now());
      const redriven = await findEvent(db, tenantId, event.outboxEventId);
      if (redriven === undefined) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const body: EventResponse = { data: toEventDelivery(redriven) };
      return c.json(body);
    });
