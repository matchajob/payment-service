import { z } from 'zod';
import { decodeGrowRef } from '@/lib/payments/grow/decode-grow-ref';
import { GROW_REF_KIND } from '@/lib/payments/grow/grow-ref-kind';

const zCardToken = z.object({
  kind: z.literal(GROW_REF_KIND.CARD),
  cardToken: z.string(),
  fullName: z.string(),
  phone: z.string(),
});

export type GrowCard = Omit<z.infer<typeof zCardToken>, 'kind'>;

export const encodeCardToken = ({ cardToken, fullName, phone }: GrowCard): string =>
  JSON.stringify({ kind: GROW_REF_KIND.CARD, cardToken, fullName, phone });

export const decodeCardToken = (ref: string): GrowCard => decodeGrowRef(zCardToken, ref);
