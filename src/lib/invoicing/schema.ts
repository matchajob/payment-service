import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { INVOICING_SERVICE } from '@/lib/invoicing/invoicing-service-name';

export const invoicingServiceEnum = createDbEnumPair('invoicingService', INVOICING_SERVICE);
export const invoicingServicePgEnum = invoicingServiceEnum.dz;
