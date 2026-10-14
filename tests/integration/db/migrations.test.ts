import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { testDb } from '@tests/utils/db';

describe('test database', () => {
  it('has the generated migrations applied before any test runs', async () => {
    const rows = await testDb().execute(sql`select to_regclass('loop_probe') as name`);
    expect(rows[0]?.['name']).toBe('loop_probe');
  });
});
