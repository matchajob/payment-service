import { describe, expect, it } from 'vitest';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { DRAIN_OUTBOX_PATH } from '@tests/utils/paths';
import { TEST_CRON_SECRET, testApp } from '@tests/utils/test-app';

const WRONG_SECRET = 'not-the-cron-secret';
const UNAUTHORIZED = 401;
const OK = 200;

describe('POST /internal/cron/drain-outbox (ADR 0002: wiring and auth only)', () => {
  it('runs the drainer and returns its counts', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(DRAIN_OUTBOX_PATH, { ...bearer(TEST_CRON_SECRET), method: 'POST' });
      expect(res.status).toBe(OK);
      expect(await res.json()).toEqual({ processed: 0, failed: 0 });
    });
  });

  it('rejects a caller without the cron secret', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(DRAIN_OUTBOX_PATH, { ...bearer(WRONG_SECRET), method: 'POST' });
      expect(res.status).toBe(UNAUTHORIZED);
    });
  });
});
