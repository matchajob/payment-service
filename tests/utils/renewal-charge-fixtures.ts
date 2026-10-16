import { CHARGE_STATUS } from '@/lib/charges/charge-status';

export const RENEWAL_CHARGE_REF = 'renewal-charge-1';
export const RENEWAL_SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: RENEWAL_CHARGE_REF } as const;
