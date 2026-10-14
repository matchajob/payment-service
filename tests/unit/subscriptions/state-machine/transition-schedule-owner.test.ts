import { describe, expect, it } from 'vitest';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { EXTERNAL, EXTERNAL_RESUME_FORBIDDEN } from '@tests/unit/subscriptions/state-machine/fixtures/contexts';
import { ROWS } from '@tests/unit/subscriptions/state-machine/fixtures/spec-rows';
import { canceled, flagged } from '@tests/unit/subscriptions/state-machine/fixtures/states';

const STORE_MANAGED = ROWS.filter((row) => row.selfOnly);
const STORE_OBSERVED = ROWS.filter((row) => !row.selfOnly);

describe('external schedule owner', () => {
  it.each(STORE_MANAGED)('$label is rejected as store-managed', ({ from, event }) => {
    expect(transition(from, event, EXTERNAL)).toEqual({ kind: 'rejected', reason: 'store_managed' });
  });

  it.each(STORE_OBSERVED)('$label is accepted from a store notification', ({ from, event, to }) => {
    expect(transition(from, event, EXTERNAL)).toMatchObject({ kind: 'accepted', to });
  });

  it('reports store_managed over tenant policy, which does not apply to external', () => {
    expect(transition(flagged, 'resume', EXTERNAL_RESUME_FORBIDDEN)).toEqual({
      kind: 'rejected',
      reason: 'store_managed',
    });
  });

  it('reports an absent pair before ownership', () => {
    expect(transition(canceled, 'cancel', EXTERNAL)).toEqual({ kind: 'rejected', reason: 'not_accepted_in_state' });
  });
});
