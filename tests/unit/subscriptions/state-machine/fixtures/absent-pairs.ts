import { LIFECYCLE_EVENTS } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { ROWS } from '@tests/unit/subscriptions/state-machine/fixtures/spec-rows';
import { STATES } from '@tests/unit/subscriptions/state-machine/fixtures/states';

export const ABSENT_PAIRS = STATES.flatMap((from) =>
  LIFECYCLE_EVENTS.filter((event) => !ROWS.some((row) => row.from === from && row.event === event)).map((event) => ({
    from,
    event,
  })),
);
