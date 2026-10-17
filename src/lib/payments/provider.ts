import type { Currency } from '@/lib/money/currency';
import type { CheckoutMode } from '@/lib/payments/checkout-mode';
import type { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import type { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';

export type ProviderCapabilities = {
  selfManagedSchedule: boolean;
  providerManagedSchedule: boolean;
  signedWebhooks: boolean;
  refunds: boolean;
  saveCardWithoutCharge: boolean;
  lookupByReference: boolean;
};

export type CheckoutRequest = {
  mode: CheckoutMode;
  reference: string;
  amountMinor: number;
  currency: Currency;
  returnUrl: string;
};
export type CheckoutSession = { checkoutUrl: string; providerSessionRef: string };

export type ChargeRequest = { paymentMethodToken: string; amountMinor: number; currency: Currency; dedupKey: string };
export type ChargeResult =
  | { outcome: 'succeeded'; providerChargeRef: string }
  | { outcome: 'failed'; providerChargeRef: string | undefined; reason: string };

export type VerifyChargeRequest = { dedupKey: string; providerChargeRef: string | null };
export type VerifiedCharge =
  | { outcome: typeof VERIFY_OUTCOME.SUCCEEDED; providerChargeRef: string; amountMinor: number; currency: Currency }
  | { outcome: typeof VERIFY_OUTCOME.FAILED; providerChargeRef: string | undefined; reason: string }
  | { outcome: typeof VERIFY_OUTCOME.PENDING }
  | { outcome: typeof VERIFY_OUTCOME.NOT_FOUND };

export type VerifiedCheckout =
  | { outcome: typeof CHECKOUT_VERIFICATION.CARD_SAVED; paymentMethodToken: string }
  | { outcome: typeof CHECKOUT_VERIFICATION.NOT_COMPLETED };

export type ParsedWebhook =
  | { kind: typeof WEBHOOK_KIND.CHECKOUT_COMPLETED; reference: string; sessionRef: string }
  | { kind: typeof WEBHOOK_KIND.UNRECOGNIZED };

export type PaymentProvider = {
  capabilities: ProviderCapabilities;
  startCheckout: (request: CheckoutRequest) => Promise<CheckoutSession>;
  charge: (request: ChargeRequest) => Promise<ChargeResult>;
  verifyCharge: (request: VerifyChargeRequest) => Promise<VerifiedCharge>;
  parseWebhook: (rawBody: string) => ParsedWebhook;
  verifyCheckout: (sessionRef: string) => Promise<VerifiedCheckout>;
};
