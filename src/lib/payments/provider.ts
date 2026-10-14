import type { Currency } from '@/lib/money/currency';
import type { CheckoutMode } from '@/lib/payments/checkout-mode';

export type ProviderCapabilities = {
  selfManagedSchedule: boolean;
  providerManagedSchedule: boolean;
  signedWebhooks: boolean;
  refunds: boolean;
};

export type CheckoutRequest = {
  mode: CheckoutMode;
  reference: string;
  amountMinor: number;
  currency: Currency;
  returnUrl: string;
};
export type CheckoutSession = { checkoutUrl: string; providerSessionRef: string };

export type ChargeRequest = { paymentMethodToken: string; amountMinor: number; dedupKey: string };
export type ChargeResult =
  | { outcome: 'succeeded'; providerChargeRef: string }
  | { outcome: 'failed'; providerChargeRef: string | undefined; reason: string };

export type VerifiedCharge = { providerChargeRef: string; outcome: 'succeeded' | 'failed' | 'pending' };

export type PaymentProvider = {
  capabilities: ProviderCapabilities;
  startCheckout: (request: CheckoutRequest) => Promise<CheckoutSession>;
  charge: (request: ChargeRequest) => Promise<ChargeResult>;
  verifyCharge: (providerChargeRef: string) => Promise<VerifiedCharge>;
};
