import type { PaymentProvider } from '@/lib/payments/provider';

const UNSUPPORTED =
  'a self-managed provider must declare saveCardWithoutCharge; providers without it are not supported yet (ADR 0007)';

export const assertProviderSupported = ({ capabilities }: PaymentProvider): void => {
  if (capabilities.selfManagedSchedule && !capabilities.saveCardWithoutCharge) throw new Error(UNSUPPORTED);
};
