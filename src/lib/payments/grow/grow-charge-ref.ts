import { z } from 'zod';
import { decodeGrowRef } from '@/lib/payments/grow/decode-grow-ref';
import { GROW_REF_KIND } from '@/lib/payments/grow/grow-ref-kind';

const zChargeRef = z.object({
  kind: z.literal(GROW_REF_KIND.CHARGE),
  transactionId: z.string(),
  transactionToken: z.string(),
});

export type GrowCharge = Omit<z.infer<typeof zChargeRef>, 'kind'>;

export const encodeChargeRef = ({ transactionId, transactionToken }: GrowCharge): string =>
  JSON.stringify({ kind: GROW_REF_KIND.CHARGE, transactionId, transactionToken });

export const decodeChargeRef = (ref: string): GrowCharge => decodeGrowRef(zChargeRef, ref);
