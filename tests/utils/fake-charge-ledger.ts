import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { ChargeRequest, ChargeResult, VerifiedCharge } from '@/lib/payments/provider';

export type ProcessedCharge = { request: ChargeRequest; result: ChargeResult };

export type FakeChargeLedger = {
  find: (dedupKey: string) => ProcessedCharge | undefined;
  record: (processed: ProcessedCharge) => void;
  all: () => ProcessedCharge[];
  verify: (dedupKey: string) => VerifiedCharge;
};

const verified = ({ request, result }: ProcessedCharge): VerifiedCharge =>
  result.outcome === CHARGE_STATUS.SUCCEEDED
    ? {
        outcome: VERIFY_OUTCOME.SUCCEEDED,
        providerChargeRef: result.providerChargeRef,
        amountMinor: request.amountMinor,
        currency: request.currency,
      }
    : { outcome: VERIFY_OUTCOME.FAILED, providerChargeRef: result.providerChargeRef, reason: result.reason };

export const fakeChargeLedger = (): FakeChargeLedger => {
  const byDedupKey = new Map<string, ProcessedCharge>();
  return {
    find: (dedupKey) => byDedupKey.get(dedupKey),
    record: (processed) => {
      byDedupKey.set(processed.request.dedupKey, processed);
    },
    all: () => [...byDedupKey.values()],
    verify: (dedupKey) => {
      const processed = byDedupKey.get(dedupKey);
      return processed === undefined ? { outcome: VERIFY_OUTCOME.NOT_FOUND } : verified(processed);
    },
  };
};
