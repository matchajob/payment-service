import { describe, expect, it } from 'vitest';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { ABSENT_PAIRS } from '@tests/unit/subscriptions/state-machine/fixtures/absent-pairs';
import { SELF } from '@tests/unit/subscriptions/state-machine/fixtures/contexts';

describe('absent pairs', () => {
  it.each(ABSENT_PAIRS)('rejects $event from %o', ({ from, event }) => {
    expect(transition(from, event, SELF)).toEqual({ kind: 'rejected', reason: 'not_accepted_in_state' });
  });
});
