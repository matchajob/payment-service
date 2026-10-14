import { randomBytes } from 'node:crypto';

const SECRET_BYTES = 32;

export const generateSecret = (): string => randomBytes(SECRET_BYTES).toString('base64url');
