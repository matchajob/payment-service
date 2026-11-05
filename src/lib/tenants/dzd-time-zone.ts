import { makeDzString } from '@matcha/infra/domain-drizzle/dz-string';
import { StrMaxSizes, StrMinSizes, zString } from '@matcha/infra/validations/z-string';
import { isIanaTimeZone } from '@/lib/time/is-iana-time-zone';

const NOT_IANA = 'must be an IANA time zone, such as Asia/Jerusalem';
const BACKFILL_TIME_ZONE = 'UTC';
const SIZE = { maxSize: StrMaxSizes.sm, minSize: StrMinSizes.nonempty } as const;

export const makeDzdTimeZone = (fieldName: string) =>
  ({
    zod: zString(SIZE).refine(isIanaTimeZone, NOT_IANA),
    db: makeDzString(fieldName, { ...SIZE, defaultValue: BACKFILL_TIME_ZONE }),
  }) as const;
