import { describe, expect, it } from 'vitest';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { SELF } from '@tests/unit/subscriptions/state-machine/fixtures/contexts';
import { ROWS } from '@tests/unit/subscriptions/state-machine/fixtures/spec-rows';

describe('transition table', () => {
  it.each(ROWS)('$label: $event', ({ from, event, to, effects, emits }) => {
    expect(transition(from, event, SELF)).toEqual({ kind: 'accepted', to, effects, emits });
  });
});
