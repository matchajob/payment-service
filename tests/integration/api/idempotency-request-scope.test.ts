import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '@/api/http-status';
import { problemSchema } from '@/contract/problem';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { subscriptionRow } from '@tests/utils/renewal-reads';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { cancelPath, postNoBody } from '@tests/utils/subscription-api';
import { testApp } from '@tests/utils/test-app';

describe('an Idempotency-Key reused on another route (Spec 3 r3, code-review-1 M2)', () => {
  it('is 422 instead of replaying the first route, so cancelling B never answers with A', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, ctx } = await seedRenewing(tx);
      const app = testApp(tx);
      const key = randomUUID();
      const otherSubscription = zSubscriptionRead.shape.subscriptionId.parse(randomUUID());
      await app.request(cancelPath(otherSubscription), postNoBody(ctx.apiKey, key));
      const res = await app.request(cancelPath(subscription.subscriptionId), postNoBody(ctx.apiKey, key));
      expect(res.status).toBe(HTTP_STATUS.UNPROCESSABLE_CONTENT);
      expect(problemSchema.parse(await res.json()).status).toBe(HTTP_STATUS.UNPROCESSABLE_CONTENT);
      expect((await subscriptionRow(tx, subscription.subscriptionId)).cancelAtPeriodEnd).toBe(false);
    });
  });
});
