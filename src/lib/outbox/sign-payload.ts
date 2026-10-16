import { createHmac } from 'node:crypto';

const ALGORITHM = 'sha256';
const ENCODING = 'hex';

export const signPayload = (secret: string, timestamp: number, body: string): string =>
  createHmac(ALGORITHM, secret).update(`${timestamp}.${body}`).digest(ENCODING);
