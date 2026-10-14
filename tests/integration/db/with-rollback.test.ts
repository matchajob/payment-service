import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { testDb, withRollback } from '@tests/utils/db';

describe('withRollback', () => {
  it('discards everything the test body wrote', async () => {
    const db = testDb();
    await withRollback(db, async (tx) => {
      await tx.execute(sql`create table rollback_probe (id int)`);
      await tx.execute(sql`insert into rollback_probe values (1)`);
    });
    const rows = await db.execute(sql`select to_regclass('rollback_probe') as name`);
    expect(rows[0]?.['name']).toBeNull();
  });
});
