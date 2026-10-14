import { createHash } from 'node:crypto';

const ALGORITHM = 'sha256';
const ENCODING = 'hex';

export const hashApiKey = (apiKey: string): string => createHash(ALGORITHM).update(apiKey).digest(ENCODING);
