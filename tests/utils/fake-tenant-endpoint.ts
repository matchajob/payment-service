import { createServer, type ServerResponse } from 'node:http';
import { onTestFinished } from 'vitest';

export const HANG = 'hang';

type Reply = number | typeof HANG;

export type ReceivedDelivery = { path: string; body: string; header: (name: string) => string | undefined };

export type FakeTenantEndpoint = {
  url: string;
  deliveries: ReceivedDelivery[];
  reply: (...replies: Reply[]) => void;
};

const LOOPBACK = '127.0.0.1';
const ANY_FREE_PORT = 0;
const WEBHOOK_PATH = '/webhooks';
const OK = 200;
const FIRST_REDIRECT = 300;
const FIRST_NON_REDIRECT = 400;
export const REDIRECT_TARGET_PATH = '/elsewhere';

const isRedirect = (status: number) => status >= FIRST_REDIRECT && status < FIRST_NON_REDIRECT;

export const fakeTenantEndpoint = async (): Promise<FakeTenantEndpoint> => {
  const deliveries: ReceivedDelivery[] = [];
  const queue: Reply[] = [];
  const hanging: ServerResponse[] = [];

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const { headers } = request;
      deliveries.push({
        path: request.url ?? '',
        body: Buffer.concat(chunks).toString('utf8'),
        header: (name) => {
          const value = headers[name.toLowerCase()];
          return Array.isArray(value) ? value.join(', ') : value;
        },
      });
      const reply = queue.shift() ?? OK;
      if (reply === HANG) {
        hanging.push(response);
        return;
      }
      if (isRedirect(reply)) response.setHeader('location', REDIRECT_TARGET_PATH);
      response.statusCode = reply;
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(ANY_FREE_PORT, LOOPBACK, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('fake tenant endpoint has no TCP address');

  onTestFinished(
    () =>
      new Promise<void>((resolve) => {
        hanging.forEach((response) => response.destroy());
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );

  return {
    url: `http://${LOOPBACK}:${address.port}${WEBHOOK_PATH}`,
    deliveries,
    reply: (...replies) => queue.push(...replies),
  };
};

export const closedEndpointUrl = async (): Promise<string> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(ANY_FREE_PORT, LOOPBACK, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('probe server has no TCP address');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://${LOOPBACK}:${address.port}${WEBHOOK_PATH}`;
};
