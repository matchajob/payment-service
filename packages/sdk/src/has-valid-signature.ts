import { signedPayload } from '@/contract/event-signature';
import { hexToBytes } from '@sdk/hex-to-bytes';

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const KEY_FORMAT = 'raw';
const KEY_USAGES: KeyUsage[] = ['verify'];
const encoder = new TextEncoder();

export const hasValidSignature = async (
  secret: string,
  timestamp: number,
  body: string,
  signatureHex: string,
): Promise<boolean> => {
  const signature = hexToBytes(signatureHex);
  if (signature === undefined) return false;
  const key = await crypto.subtle.importKey(KEY_FORMAT, encoder.encode(secret), ALGORITHM, false, KEY_USAGES);
  return crypto.subtle.verify(ALGORITHM.name, key, signature, encoder.encode(signedPayload(timestamp, body)));
};
