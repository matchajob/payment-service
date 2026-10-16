import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';

export const paymentProviderEnum = createDbEnumPair('paymentProvider', PAYMENT_PROVIDER);
export const paymentProviderPgEnum = paymentProviderEnum.dz;
