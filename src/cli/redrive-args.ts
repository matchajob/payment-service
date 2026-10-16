import { parseArgs } from 'node:util';
import { zOutboxEventRead } from '@/lib/outbox/schema';
import type { RedriveFilter } from '@/lib/outbox/redrive-dead-letters';

const eventArgsSchema = zOutboxEventRead.pick({ outboxEventId: true });
const tenantArgsSchema = zOutboxEventRead.pick({ tenantId: true });

export const readRedriveArgs = (argv: string[]): RedriveFilter => {
  const { values } = parseArgs({
    args: argv,
    options: { event: { type: 'string' }, tenant: { type: 'string' } },
  });
  if ((values.event === undefined) === (values.tenant === undefined)) {
    throw new Error('pass exactly one of --event <outboxEventId> or --tenant <tenantId>');
  }
  return values.event === undefined
    ? tenantArgsSchema.parse({ tenantId: values.tenant })
    : eventArgsSchema.parse({ outboxEventId: values.event });
};
