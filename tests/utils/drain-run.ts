import type { Database } from '@/lib/db';
import { DELIVERY_TIMEOUT_MS } from '@/lib/outbox/delivery-timing';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { silentLogger } from '@tests/utils/silent-logger';

export const drainWith =
  (db: Database, timeoutMs: number = DELIVERY_TIMEOUT_MS) =>
  (now: Date) =>
    drainOutbox({ db, logger: silentLogger, timeoutMs }, now);
