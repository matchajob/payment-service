import type {
  ChargeRequest,
  ChargeResult,
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  VerifiedCharge,
} from '@/lib/payments/provider';

export type FakePaymentProvider = PaymentProvider & {
  calls: { startCheckout: CheckoutRequest[]; charge: ChargeRequest[]; verifyCharge: string[] };
  scriptCharge: (result: ChargeResult) => void;
  scriptVerify: (result: VerifiedCharge) => void;
  failCheckouts: () => void;
};

export const FAKE_CHECKOUT_URL = 'https://fake.provider/checkout';
export const FAKE_CHECKOUT_FAILURE = 'fakePaymentProvider: checkout scripted to fail';

export const fakePaymentProvider = (): FakePaymentProvider => {
  const calls: FakePaymentProvider['calls'] = { startCheckout: [], charge: [], verifyCharge: [] };
  const scripted: { charge: ChargeResult[]; verify: VerifiedCharge[]; checkoutFails: boolean } = {
    charge: [],
    verify: [],
    checkoutFails: false,
  };

  const next = <T>(queue: T[], method: string): T => {
    const result = queue.shift();
    if (result === undefined) throw new Error(`fakePaymentProvider: no scripted result for ${method}`);
    return result;
  };
  return {
    capabilities: {
      selfManagedSchedule: true,
      providerManagedSchedule: false,
      signedWebhooks: false,
      refunds: false,
      saveCardWithoutCharge: true,
    },
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
    startCheckout: async (request) => {
      calls.startCheckout.push(request);
      if (scripted.checkoutFails) throw new Error(FAKE_CHECKOUT_FAILURE);
      return { checkoutUrl: FAKE_CHECKOUT_URL, providerSessionRef: `session-${calls.startCheckout.length}` };
    },
    charge: async (request) => {
      calls.charge.push(request);
      return next(scripted.charge, 'charge');
    },
    verifyCharge: async (ref) => {
      calls.verifyCharge.push(ref);
      return next(scripted.verify, 'verifyCharge');
    },
  };
};
