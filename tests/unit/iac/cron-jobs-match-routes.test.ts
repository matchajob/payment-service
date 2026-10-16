import { describe, expect, it } from 'vitest';
import { CRON_JOBS } from '@iac/cron-jobs';
import { createDb } from '@/lib/db';
import { testApp } from '@tests/utils/test-app';

const UNCONNECTED_DATABASE_URL = 'postgresql://unused:unused@localhost:1/unused';

describe('cron jobs match the routes (ADR 0002)', () => {
  it('schedules only paths the app serves as POST', () => {
    const app = testApp(createDb(UNCONNECTED_DATABASE_URL));
    const postPaths = app.routes.filter((r) => r.method === 'POST').map((r) => r.path);
    for (const job of CRON_JOBS) {
      expect(postPaths).toContain(job.path);
    }
  });

  it('schedules every cron route the app serves', () => {
    const app = testApp(createDb(UNCONNECTED_DATABASE_URL));
    const cronPaths = app.routes
      .filter((r) => r.method === 'POST' && r.path.startsWith('/internal/cron/'))
      .map((r) => r.path);
    expect(CRON_JOBS.map((j) => j.path).sort()).toEqual([...new Set(cronPaths)].sort());
  });
});
