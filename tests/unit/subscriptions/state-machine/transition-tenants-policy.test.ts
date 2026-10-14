import { describe, expect, it } from 'vitest';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { SELF_RESUME_FORBIDDEN } from '@tests/unit/subscriptions/state-machine/fixtures/contexts';
import { flagged } from '@tests/unit/subscriptions/state-machine/fixtures/states';

describe('tenant policy', () => {
    it('r9 rejects resume when the tenant forbids it', () => {
        expect(transition(flagged, 'resume', SELF_RESUME_FORBIDDEN)).toEqual({
            kind: 'rejected',
            reason: 'resume_not_allowed',
        });
    });
});