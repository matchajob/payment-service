import { CHARGE_STATUS } from '@/lib/charges/charge-status';

export const VERIFY_OUTCOME = { ...CHARGE_STATUS, NOT_FOUND: 'not_found' } as const;

export type VerifyOutcome = (typeof VERIFY_OUTCOME)[keyof typeof VERIFY_OUTCOME];
