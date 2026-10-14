import { describe, expect, it } from 'vitest';
import { testApp } from '@tests/utils/test-app';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { testDb } from '@tests/utils/db';

const db = testDb();

describe('request logging', () => {
  it('writes one line per request with method, path, status and duration', async () => {
    const capture = capturingLogger();
    await testApp(db, { logger: capture.logger }).request('/health');
    expect(capture.lines()).toEqual([
      expect.objectContaining({
        msg: 'request',
        method: 'GET',
        path: '/health',
        status: 200,
        durationMs: expect.any(Number),
      }),
    ]);
  });

  it('logs the status the client received, including 404', async () => {
    const capture = capturingLogger();
    await testApp(db, { logger: capture.logger }).request('/nope');
    expect(capture.lines()).toContainEqual(expect.objectContaining({ path: '/nope', status: 404 }));
  });
});
