import { describe, expect, it } from 'vitest';
import { LIFECYCLE_EVENTS } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { ROWS } from '@tests/unit/subscriptions/state-machine/fixtures/spec-rows';
import { STATES } from '@tests/unit/subscriptions/state-machine/fixtures/states';

const ALLOWED = { resumeAllowed: true };

const ABSENT = STATES.flatMap((from) =>
  LIFECYCLE_EVENTS.filter((event) => !ROWS.some(([, f, e]) => f === from && e === event)).map(
    (event) => [from, event] as const,
  ),
);

describe('transition table', () => {
  it.each(ROWS)('%s: %o on %s lands in %o', (_label, from, event, to) => {
    expect(transition(from, event, ALLOWED)).toMatchObject({ kind: 'accepted', to });
  });

  it.each(ABSENT)('rejects %o on %s', (from, event) => {
    expect(transition(from, event, ALLOWED).kind).toBe('rejected');
  });
});
