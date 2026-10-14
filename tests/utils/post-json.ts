import { randomUUID } from 'node:crypto';

export const postJson = (apiKey: string, body: unknown, idempotencyKey: string | null = randomUUID()): RequestInit => ({
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    ...(idempotencyKey === null ? {} : { 'idempotency-key': idempotencyKey }),
  },
  body: JSON.stringify(body),
});
