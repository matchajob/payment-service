import type { Logger } from 'pino';
import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/app';
import { problemSchema } from '@/contract/problem';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { testDb } from '@tests/utils/db';

const db = testDb();
const boomApp = (logger: Logger) => {
  const app = createApp({ logger, db });
  app.get('/boom', () => {
    throw new Error('boom');
  });
  return app;
};

describe('error handler', () => {
  it('answers an unhandled error with a 500 problem+json', async () => {
    const res = await boomApp(capturingLogger().logger).request('/boom');
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(problemSchema.parse(await res.json()).status).toBe(500);
  });

  it('logs the error instead of swallowing it', async () => {
    const capture = capturingLogger();
    await boomApp(capture.logger).request('/boom');
    expect(capture.lines()).toContainEqual(
      expect.objectContaining({ msg: 'unhandled', path: '/boom', err: expect.objectContaining({ message: 'boom' }) }),
    );
  });
});
