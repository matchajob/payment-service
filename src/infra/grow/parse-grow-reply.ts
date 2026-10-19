import { z } from 'zod';
import type { GrowReply } from '@/infra/grow/grow-reply';

const GROW_STATUS = { OK: 1, FAILED: 0 } as const;
const UNREADABLE = 'grow reply is not its JSON envelope';

const growError = z.object({ id: z.coerce.number().int().positive(), message: z.string() });

const okEnvelope = z.object({ status: z.coerce.number().pipe(z.literal(GROW_STATUS.OK)), data: z.unknown() });
const failedEnvelope = z.object({
  status: z.coerce.number().pipe(z.literal(GROW_STATUS.FAILED)),
  err: growError,
});

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

export const parseGrowReply = (body: string): GrowReply => {
  const json = parseJson(body);
  const ok = okEnvelope.safeParse(json);
  if (ok.success) return { ok: true, data: ok.data.data };
  const failed = failedEnvelope.safeParse(json);
  if (failed.success) return { ok: false, errorId: failed.data.err.id, message: failed.data.err.message };
  throw new Error(UNREADABLE);
};
