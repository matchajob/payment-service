import { z } from 'zod';
import { decodeGrowRef } from '@/lib/payments/grow/decode-grow-ref';
import { GROW_REF_KIND } from '@/lib/payments/grow/grow-ref-kind';

const zSessionRef = z.object({
  kind: z.literal(GROW_REF_KIND.SESSION),
  processId: z.string(),
  processToken: z.string(),
});

export type GrowSession = Omit<z.infer<typeof zSessionRef>, 'kind'>;

export const encodeSessionRef = ({ processId, processToken }: GrowSession): string =>
  JSON.stringify({ kind: GROW_REF_KIND.SESSION, processId, processToken });

export const decodeSessionRef = (ref: string): GrowSession => decodeGrowRef(zSessionRef, ref);
