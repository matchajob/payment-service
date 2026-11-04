import { sha256Hex } from '@/lib/crypto/sha256-hex';

export type HashedRequest = { method: string; path: string; body: string };

export const requestHash = ({ method, path, body }: HashedRequest): string =>
  sha256Hex(JSON.stringify([method, path, body]));
