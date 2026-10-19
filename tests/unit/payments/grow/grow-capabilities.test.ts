import { describe, expect, it } from 'vitest';
import { assertProviderSupported } from '@/lib/payments/assert-provider-supported';
import { growUnderTest } from '@tests/utils/grow-provider-under-test';
import { GROW_PAGE_CODE, GROW_USER_ID } from '@tests/utils/provider-credentials-fixtures';

const MISSING_PAGE_CODE = JSON.stringify({ userId: GROW_USER_ID });
const MISSING_USER_ID = JSON.stringify({ pageCode: GROW_PAGE_CODE });
const NOT_JSON = 'userId=grow-user-1&pageCode=grow-page-1';

describe('growProvider: capabilities (WORKPLAN slice 13, ADR 0007)', () => {
  it('is a self-managed, unsigned provider that saves a card without charging and looks up by our reference', () => {
    expect(growUnderTest().grow.capabilities).toEqual({
      selfManagedSchedule: true,
      providerManagedSchedule: false,
      signedWebhooks: false,
      refunds: false,
      saveCardWithoutCharge: true,
      lookupByReference: true,
    });
  });

  it('passes the boot guard that refuses self-managed providers without a card-only save', () => {
    expect(() => assertProviderSupported(growUnderTest().grow)).not.toThrow();
  });
});

describe('growProvider: merchant credentials (ADR 0010, grow skill Credentials)', () => {
  it('refuses credentials without a pageCode, so the connection is never created', () => {
    expect(() => growUnderTest(MISSING_PAGE_CODE)).toThrow();
  });

  it('refuses credentials without a userId', () => {
    expect(() => growUnderTest(MISSING_USER_ID)).toThrow();
  });

  it('refuses credentials that are not JSON', () => {
    expect(() => growUnderTest(NOT_JSON)).toThrow();
  });
});
