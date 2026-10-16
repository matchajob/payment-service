import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import type { Clock } from '@/lib/clock';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import { findProviderConnection } from '@/lib/provider-connections/find-provider-connection';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { zProviderConnectionRead } from '@/lib/provider-connections/schema';
import { completeCheckout } from '@/lib/subscriptions/complete-checkout';
import { markWebhookProcessed } from '@/lib/webhooks/mark-webhook-processed';
import { recordWebhookEvent } from '@/lib/webhooks/record-webhook-event';

const providerParam = zProviderConnectionRead.shape.provider;
const connectionParam = zProviderConnectionRead.shape.providerConnectionId;

export const webhooksRoutes = (providerFor: ProviderFor, clock: Clock) =>
  new Hono<AppEnv>().post('/:provider/:providerConnectionId', async (c) => {
    const providerName = providerParam.safeParse(c.req.param('provider'));
    const connectionId = connectionParam.safeParse(c.req.param('providerConnectionId'));
    if (!providerName.success || !connectionId.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
    const db = c.get('db');
    const connection = await findProviderConnection(db, connectionId.data);
    if (connection?.provider !== providerName.data) return problemResponse(c, HTTP_STATUS.NOT_FOUND);

    const event = await recordWebhookEvent(db, {
      providerConnectionId: connection.providerConnectionId,
      provider: connection.provider,
      rawBody: await c.req.text(),
      receivedAt: clock.now(),
    });
    if (event.processedAt !== null) return c.body(null, HTTP_STATUS.OK);

    const provider = await providerFor(connection);
    const parsed = provider.parseWebhook(event.rawBody);
    if (parsed.kind === WEBHOOK_KIND.CHECKOUT_COMPLETED) {
      await completeCheckout(
        { db, provider, clock },
        {
          providerConnectionId: connection.providerConnectionId,
          reference: parsed.reference,
          sessionRef: parsed.sessionRef,
        },
      );
    }
    await markWebhookProcessed(db, event.webhookEventId, clock.now());
    return c.body(null, HTTP_STATUS.OK);
  });
