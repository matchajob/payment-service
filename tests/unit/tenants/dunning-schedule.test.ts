import { describe, expect, it } from 'vitest';
import { zTenantCreate } from '@/lib/tenants/schema';
import { TENANT_POLICY_DEFAULTS } from '@/lib/tenants/tenant-policy-defaults';

const schedule = zTenantCreate.shape.dunningScheduleDays;

describe('tenant dunning schedule (D3, ADR 0014)', () => {
  it('accepts the default schedule', () => {
    expect(schedule.safeParse([...TENANT_POLICY_DEFAULTS.dunningScheduleDays]).success).toBe(true);
  });

  it('rejects an empty schedule, which would leave a past_due subscription with no retry and no end', () => {
    expect(schedule.safeParse([]).success).toBe(false);
  });
});
