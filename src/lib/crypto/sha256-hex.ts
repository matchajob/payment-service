import { createHash } from 'node:crypto';

const ALGORITHM = 'sha256';
const ENCODING = 'hex';

export const sha256Hex = (input: string): string => createHash(ALGORITHM).update(input).digest(ENCODING);
