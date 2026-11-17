import type { Logger } from 'pino';

export const SHUTDOWN_STARTED = 'shutting down: no new requests, waiting for in-flight ones';
export const SHUTDOWN_DONE = 'shut down';

type Closable = { close: (done: (error?: Error) => void) => unknown };

export type GracefulShutdownDeps = {
  server: Closable;
  closeDb: () => Promise<void>;
  logger: Pick<Logger, 'info'>;
};

const closeServer = (server: Closable) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });

export const gracefulShutdown =
  ({ server, closeDb, logger }: GracefulShutdownDeps) =>
  async (): Promise<void> => {
    logger.info(SHUTDOWN_STARTED);
    try {
      await closeServer(server);
    } finally {
      await closeDb();
    }
    logger.info(SHUTDOWN_DONE);
  };
