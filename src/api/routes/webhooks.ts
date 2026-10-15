import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import type { Clock } from '@/lib/clock';
import type { PaymentProvider } from '@/lib/payments/provider';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import { findTenantBySlug } from '@/lib/tenants/find-tenant-by-slug';
import { markWebhookProcessed } from '@/lib/webhooks/mark-webhook-processed';
import { recordWebhookEvent } from '@/lib/webhooks/record-webhook-event';
import { zWebhookEventRead } from '@/lib/webhooks/schema';
import { completeCheckout } from '@/lib/subscriptions/complete-checkout';

const providerParam = zWebhookEventRead.shape.provider;

export const webhooksRoutes = (provider: PaymentProvider, clock: Clock) =>
  new Hono<AppEnv>().post('/:provider/:tenantSlug', async (c) => {
    const providerName = providerParam.safeParse(c.req.param('provider'));
    if (!providerName.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
    const db = c.get('db');
    const tenant = await findTenantBySlug(db, c.req.param('tenantSlug'));
    if (tenant === undefined) return problemResponse(c, HTTP_STATUS.NOT_FOUND);

    const event = await recordWebhookEvent(db, {
      tenantId: tenant.tenantId,
      provider: providerName.data,
      rawBody: await c.req.text(),
      receivedAt: clock.now(),
    });
    if (event.processedAt !== null) return c.body(null, HTTP_STATUS.OK);

    const parsed = provider.parseWebhook(event.rawBody);
    if (parsed.kind === WEBHOOK_KIND.CHECKOUT_COMPLETED) {
      await completeCheckout(
        { db, provider, clock },
        { tenant, reference: parsed.reference, sessionRef: parsed.sessionRef },
      );
    }
    await markWebhookProcessed(db, event.webhookEventId, clock.now());
    return c.body(null, HTTP_STATUS.OK);
  });
