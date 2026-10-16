import type { Context } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { RETRY_AFTER_HEADER } from '@/api/retry-after';
import type { SubscriptionResponse } from '@/contract/subscription-response';
import { COMMAND_RESULT, type CommandResult } from '@/lib/subscriptions/command-result';
import { toSnapshot } from '@/lib/subscriptions/to-snapshot';

const CHARGE_IN_FLIGHT_RETRY_AFTER_SECONDS = '60';

export const subscriptionResultResponse = (c: Context<AppEnv>, result: CommandResult) => {
  if (result.kind === COMMAND_RESULT.NOT_FOUND) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
  if (result.kind === COMMAND_RESULT.REJECTED) return problemResponse(c, HTTP_STATUS.CONFLICT, result.reason);
  if (result.kind === COMMAND_RESULT.CHARGE_IN_FLIGHT) {
    c.header(RETRY_AFTER_HEADER, CHARGE_IN_FLIGHT_RETRY_AFTER_SECONDS);
    return problemResponse(c, HTTP_STATUS.CONFLICT, result.kind);
  }
  const response: SubscriptionResponse = { data: toSnapshot(result.subscription, result.customer, c.get('tenant')) };
  return c.json(response, HTTP_STATUS.OK);
};
