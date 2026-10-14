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
};

const FAKE_CHECKOUT_URL = 'https://fake.provider/checkout';

export const fakePaymentProvider = (): FakePaymentProvider => {
    const calls = { startCheckout: [] as CheckoutRequest[], charge: [] as ChargeRequest[], verifyCharge: [] as string[] };
    const scripted = { charge: [] as ChargeResult[], verify: [] as VerifiedCharge[] };
    const next = <T>(queue: T[], method: string): T =>  {
        const result = queue.shift();
        if (result === undefined) throw new Error(`fakePaymentProvider: no scripted result for ${method}`);
        return result;
    };
    return {
        capabilities: { selfManagedSchedule: true, providerManagedSchedule: false, signedWebhooks: false, refunds: false },
        calls,
        scriptCharge: (result) => {
        scripted.charge.push(result);
        },
        scriptVerify: (result) => {
        scripted.verify.push(result);
        },
        startCheckout: async (request) => {
        calls.startCheckout.push(request);
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