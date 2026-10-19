import { DAY_MS } from '@/lib/time/day-ms';
import { PERIOD_END } from '@tests/utils/renewal-rows';

export const DUNNING_STARTED_AT = PERIOD_END;
export const dunningDay = (days: number): Date => new Date(DUNNING_STARTED_AT.getTime() + days * DAY_MS);

export const FIRST_RETRY_DAY = 1;
export const SECOND_RETRY_DAY = 3;
export const FINAL_RETRY_DAY = 7;
export const RETRY_DAYS = [FIRST_RETRY_DAY, SECOND_RETRY_DAY, FINAL_RETRY_DAY];
