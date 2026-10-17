import { z } from 'zod';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import type {
  ChargeRequest,
  ChargeResult,
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  ProviderCapabilities,
  VerifiedCharge,
  VerifyChargeRequest,
} from '@/lib/payments/provider';

export type FakePaymentProvider = PaymentProvider & {
  calls: {
    startCheckout: CheckoutRequest[];
    verifyCheckout: string[];
    charge: ChargeRequest[];
    verifyCharge: VerifyChargeRequest[];
  };
  scriptCharge: (result: ChargeResult) => void;
  scriptVerify: (result: VerifiedCharge) => void;
  failCheckouts: () => void;
  scriptCheckoutNotCompleted: () => void;
  failCharges: () => void;
  failVerifies: () => void;
  withoutReferenceLookup: () => void;
  lastCheckoutSession: () => CheckoutSession;
};

export const FAKE_CHECKOUT_COMPLETED = 'checkout.completed';

const fakeCheckoutCompleted = z.object({
  type: z.literal(FAKE_CHECKOUT_COMPLETED),
  reference: z.string(),
  sessionRef: z.string(),
});

const parseJson = (rawBody: string): unknown => {
  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
};

export const fakeCheckoutCompletedBody = (reference: string, sessionRef: string) =>
  JSON.stringify({ type: FAKE_CHECKOUT_COMPLETED, reference, sessionRef });

export const FAKE_CHECKOUT_URL = 'https://fake.provider/checkout';
export const FAKE_CHARGE_TIMEOUT = 'fakePaymentProvider: charge scripted to time out';
export const FAKE_CHECKOUT_FAILURE = 'fakePaymentProvider: checkout scripted to fail';
export const FAKE_NO_CHECKOUT = 'fakePaymentProvider: no checkout started';
export const FAKE_VERIFY_FAILURE = 'fakePaymentProvider: verifyCharge scripted to fail';

export const fakePaymentProvider = (): FakePaymentProvider => {
  const calls: FakePaymentProvider['calls'] = { startCheckout: [], verifyCheckout: [], charge: [], verifyCharge: [] };
  const scripted: {
    charge: ChargeResult[];
    verify: VerifiedCharge[];
    checkoutFails: boolean;
    checkoutNotCompleted: boolean;
    chargeThrows: boolean;
    verifyThrows: boolean;
  } = {
    charge: [],
    verify: [],
    checkoutFails: false,
    checkoutNotCompleted: false,
    chargeThrows: false,
    verifyThrows: false,
  };
  const sessions: CheckoutSession[] = [];
  const capabilities: ProviderCapabilities = {
    selfManagedSchedule: true,
    providerManagedSchedule: false,
    signedWebhooks: false,
    refunds: false,
    saveCardWithoutCharge: true,
    lookupByReference: true,
  };

  const next = <T>(queue: T[], method: string): T => {
    const result = queue.shift();
    if (result === undefined) throw new Error(`fakePaymentProvider: no scripted result for ${method}`);
    return result;
  };
  return {
    capabilities,
    calls,
    scriptCharge: (result) => {
      scripted.charge.push(result);
    },
    scriptVerify: (result) => {
      scripted.verify.push(result);
    },
    failCheckouts: () => {
      scripted.checkoutFails = true;
    },
    scriptCheckoutNotCompleted: () => {
      scripted.checkoutNotCompleted = true;
    },
    failCharges: () => {
      scripted.chargeThrows = true;
    },
    failVerifies: () => {
      scripted.verifyThrows = true;
    },
    withoutReferenceLookup: () => {
      capabilities.lookupByReference = false;
    },
    verifyCheckout: async (sessionRef) => {
      calls.verifyCheckout.push(sessionRef);
      if (scripted.checkoutNotCompleted) return { outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED };
      return { outcome: CHECKOUT_VERIFICATION.CARD_SAVED, paymentMethodToken: `token-${sessionRef}` };
    },
    parseWebhook: (rawBody) => {
      const parsed = fakeCheckoutCompleted.safeParse(parseJson(rawBody));
      if (!parsed.success) return { kind: WEBHOOK_KIND.UNRECOGNIZED };
      const { reference, sessionRef } = parsed.data;
      return { kind: WEBHOOK_KIND.CHECKOUT_COMPLETED, reference, sessionRef };
    },
    startCheckout: async (request) => {
      calls.startCheckout.push(request);
      if (scripted.checkoutFails) throw new Error(FAKE_CHECKOUT_FAILURE);
      const session = { checkoutUrl: FAKE_CHECKOUT_URL, providerSessionRef: `session-${calls.startCheckout.length}` };
      sessions.push(session);
      return session;
    },
    lastCheckoutSession: () => {
      const session = sessions.at(-1);
      if (session === undefined) throw new Error(FAKE_NO_CHECKOUT);
      return session;
    },
    charge: async (request) => {
      calls.charge.push(request);
      if (scripted.chargeThrows) throw new Error(FAKE_CHARGE_TIMEOUT);
      return next(scripted.charge, 'charge');
    },
    verifyCharge: async (request) => {
      calls.verifyCharge.push(request);
      if (scripted.verifyThrows) throw new Error(FAKE_VERIFY_FAILURE);
      return next(scripted.verify, 'verifyCharge');
    },
  };
};
