import { describe, expect, it } from 'vitest';
import { isStaleRunDatabase, runDatabaseName } from '@tests/setup/run-database-name';

const NOW = new Date('2026-10-16T19:00:00.000Z');
const TWO_HOURS_LATER = new Date('2026-10-16T21:00:00.000Z');
const TEN_MINUTES_LATER = new Date('2026-10-16T19:10:00.000Z');
const SHARED_DATABASE = 'payment_service_test';

describe('per-run test databases (ADR 0003, amended 2026-10-16)', () => {
  it('gives two runs started at the same moment different databases', () => {
    expect(runDatabaseName(NOW)).not.toBe(runDatabaseName(NOW));
  });

  it("treats another run's database as stale only after an hour, so a live run is never dropped", () => {
    const name = runDatabaseName(NOW);
    expect(isStaleRunDatabase(name, TEN_MINUTES_LATER)).toBe(false);
    expect(isStaleRunDatabase(name, TWO_HOURS_LATER)).toBe(true);
  });

  it('never treats a database it did not create as stale', () => {
    expect(isStaleRunDatabase(SHARED_DATABASE, TWO_HOURS_LATER)).toBe(false);
  });
});
