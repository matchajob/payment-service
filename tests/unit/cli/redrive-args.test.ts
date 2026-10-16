import { describe, expect, it } from 'vitest';
import { readRedriveArgs } from '@/cli/redrive-args';

const EVENT_ID = '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b';
const TENANT_ID = '3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d';

describe('readRedriveArgs', () => {
  it('reads one event to redrive', () => {
    expect(readRedriveArgs(['--event', EVENT_ID])).toEqual({ outboxEventId: EVENT_ID });
  });

  it('reads one tenant whose dead events to redrive', () => {
    expect(readRedriveArgs(['--tenant', TENANT_ID])).toEqual({ tenantId: TENANT_ID });
  });

  it('refuses no target, so a bare run never redrives everything', () => {
    expect(() => readRedriveArgs([])).toThrow();
  });

  it('refuses both targets at once, so the scope is never ambiguous', () => {
    expect(() => readRedriveArgs(['--event', EVENT_ID, '--tenant', TENANT_ID])).toThrow();
  });

  it('refuses an id that is not a uuid', () => {
    expect(() => readRedriveArgs(['--event', 'not-a-uuid'])).toThrow();
  });
});
