import type { VerifiedCharge } from '@/lib/payments/provider';
import { STRIPE_INTENT_STATUS } from '@/lib/payments/stripe/stripe-intent-status';
import type { StripePaymentIntent } from '@/lib/payments/stripe/stripe-payment-intent';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';

const FAILED_STATUSES: readonly string[] = [
  STRIPE_INTENT_STATUS.REQUIRES_PAYMENT_METHOD,
  STRIPE_INTENT_STATUS.CANCELED,
  STRIPE_INTENT_STATUS.REQUIRES_ACTION,
  STRIPE_INTENT_STATUS.REQUIRES_CONFIRMATION,
];

export const verifiedFromIntent = (intent: StripePaymentIntent): VerifiedCharge => {
  if (intent.status === STRIPE_INTENT_STATUS.SUCCEEDED)
    return {
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef: intent.id,
      amountMinor: intent.amount,
      currency: intent.currency,
    };
  if (FAILED_STATUSES.includes(intent.status))
    return {
      outcome: VERIFY_OUTCOME.FAILED,
      providerChargeRef: intent.id,
      reason: intent.last_payment_error?.decline_code ?? intent.last_payment_error?.code ?? intent.status,
    };
  return { outcome: VERIFY_OUTCOME.PENDING };
};
