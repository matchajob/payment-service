import { randomBytes } from 'node:crypto';

const SECRET_BYTES = 32;
const ENCODING = 'base64url';

export const generateSecret = (): string => randomBytes(SECRET_BYTES).toString(ENCODING);
