import { CHARGE_KIND, type ChargeKind } from '@/lib/charges/charge-kind';
import { dunningDay, FINAL_RETRY_DAY, FIRST_RETRY_DAY, RETRY_DAYS } from '@tests/utils/dunning-days';
import { ACTIVATED_AT, NEXT_PERIOD_END, PERIOD_END } from '@tests/utils/renewal-rows';

export type ChargeShape = { kind: ChargeKind; periodEnd: Date; attempt: number; attemptedAt: Date };

const FIRST_CHARGE_ATTEMPT = 0;
const RENEWAL_ATTEMPT = 0;
const FIRST_RETRY_ATTEMPT = 1;
const IMMEDIATE_RETRY_DAY = 5;

export const FIRST_CHARGE_AT = ACTIVATED_AT;
export const RENEWAL_ATTEMPTED_AT = PERIOD_END;
export const RETRY_ATTEMPTED_AT = dunningDay(FIRST_RETRY_DAY);
export const IMMEDIATE_RETRY_ATTEMPTED_AT = dunningDay(IMMEDIATE_RETRY_DAY);
export const RETRIES_BEFORE_CARD_UPDATE = 2;

export const FIRST_CHARGE: ChargeShape = {
  kind: CHARGE_KIND.FIRST,
  periodEnd: PERIOD_END,
  attempt: FIRST_CHARGE_ATTEMPT,
  attemptedAt: FIRST_CHARGE_AT,
};
export const RENEWAL: ChargeShape = {
  kind: CHARGE_KIND.RENEWAL,
  periodEnd: NEXT_PERIOD_END,
  attempt: RENEWAL_ATTEMPT,
  attemptedAt: RENEWAL_ATTEMPTED_AT,
};
export const IMMEDIATE_RETRY: ChargeShape = {
  kind: CHARGE_KIND.IMMEDIATE_RETRY,
  periodEnd: NEXT_PERIOD_END,
  attempt: RETRIES_BEFORE_CARD_UPDATE + 1,
  attemptedAt: IMMEDIATE_RETRY_ATTEMPTED_AT,
};

export const retryShape = (attempt: number): ChargeShape => ({
  kind: CHARGE_KIND.RETRY,
  periodEnd: NEXT_PERIOD_END,
  attempt,
  attemptedAt: dunningDay(RETRY_DAYS[attempt - FIRST_RETRY_ATTEMPT] ?? FINAL_RETRY_DAY),
});

export const FIRST_RETRY = retryShape(FIRST_RETRY_ATTEMPT);
