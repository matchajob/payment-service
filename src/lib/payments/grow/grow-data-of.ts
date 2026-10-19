import type { z } from 'zod';
import type { GrowReply } from '@/infra/grow/grow-reply';

const REFUSED = 'grow refused';

export const growDataOf = <T>(method: string, reply: GrowReply, schema: z.ZodType<T>): T => {
  if (!reply.ok) throw new Error(`${REFUSED} ${method}: ${reply.errorId} ${reply.message}`);
  return schema.parse(reply.data);
};
