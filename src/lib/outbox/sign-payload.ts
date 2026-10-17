import { createHmac } from 'node:crypto';
import { signedPayload } from '@/contract/event-signature';

const ALGORITHM = 'sha256';
const ENCODING = 'hex';

export const signPayload = (secret: string, timestamp: number, body: string): string =>
  createHmac(ALGORITHM, secret).update(signedPayload(timestamp, body)).digest(ENCODING);
