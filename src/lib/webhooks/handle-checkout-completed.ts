import { completePaymentMethodUpdate } from '@/lib/payment-method-updates/complete-payment-method-update';
import { findPaymentMethodUpdate } from '@/lib/payment-method-updates/find-payment-method-update';
import {
  completeCheckout,
  type CompleteCheckoutDeps,
  type CompleteCheckoutInput,
} from '@/lib/subscriptions/complete-checkout';

export const handleCheckoutCompleted = async (deps: CompleteCheckoutDeps, input: CompleteCheckoutInput) => {
  const update = await findPaymentMethodUpdate(deps.db, input.providerConnectionId, input.sessionRef);
  if (update === undefined) return completeCheckout(deps, input);
  return completePaymentMethodUpdate(deps, update, input.reference);
};
