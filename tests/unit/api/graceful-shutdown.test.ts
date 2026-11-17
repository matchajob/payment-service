import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { gracefulShutdown, SHUTDOWN_DONE, SHUTDOWN_STARTED } from '@/api/graceful-shutdown';
import { capturingLogger } from '@tests/utils/capturing-logger';

const SLOW_PATH = '/slow';
const FINISHED = 'finished';
const LOOPBACK = 'http://127.0.0.1';
const EPHEMERAL_PORT = 0;
const RESPONDED = 'response';
const DB_CLOSED = 'db closed';
const NOT_LISTENING = 'server is not listening on a TCP port';

const slowServer = () => {
  const gate: { open?: () => void } = {};
  const opened = new Promise<void>((resolve) => {
    gate.open = resolve;
  });
  const started: { signal?: () => void } = {};
  const requestStarted = new Promise<void>((resolve) => {
    started.signal = resolve;
  });
  const app = new Hono().get(SLOW_PATH, async (c) => {
    started.signal?.();
    await opened;
    return c.text(FINISHED);
  });
  const server = serve({ fetch: app.fetch, port: EPHEMERAL_PORT });
  const url = () => {
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error(NOT_LISTENING);
    return `${LOOPBACK}:${address.port}${SLOW_PATH}`;
  };
  return { server, url, requestStarted, finishRequest: () => gate.open?.() };
};

describe('gracefulShutdown (code-review-1 M22)', () => {
  it('lets the in-flight request finish, then closes the database pool', async () => {
    const { server, url, requestStarted, finishRequest } = slowServer();
    const order: string[] = [];
    const log = capturingLogger();
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const inFlight = fetch(url()).then(async (res) => {
      order.push(RESPONDED);
      return res.text();
    });
    await requestStarted;

    const shutdown = gracefulShutdown({
      server,
      closeDb: async () => {
        order.push(DB_CLOSED);
      },
      logger: log.logger,
    })();
    finishRequest();

    expect(await inFlight).toBe(FINISHED);
    await shutdown;
    expect(order).toEqual([RESPONDED, DB_CLOSED]);
    expect(log.lines().map(({ msg }) => msg)).toEqual([SHUTDOWN_STARTED, SHUTDOWN_DONE]);
  });

  it('still closes the pool when the server was already closed, and reports the failure', async () => {
    const { server } = slowServer();
    await new Promise<void>((resolve) => server.once('listening', resolve));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const closed = { db: false };

    await expect(
      gracefulShutdown({
        server,
        closeDb: async () => {
          closed.db = true;
        },
        logger: capturingLogger().logger,
      })(),
    ).rejects.toThrow();
    expect(closed.db).toBe(true);
  });
});
