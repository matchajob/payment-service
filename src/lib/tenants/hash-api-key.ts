import { sha256Hex } from '@/lib/crypto/sha256-hex';

export const hashApiKey = (apiKey: string): string => sha256Hex(apiKey);
