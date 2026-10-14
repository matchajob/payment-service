import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { CURRENCY } from '@/lib/money/currency';

export const currencyEnum = createDbEnumPair('currency', CURRENCY);

export const currencyPgEnum = currencyEnum.dz;
