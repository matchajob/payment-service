import type { Logger } from 'pino';
import { CHECKOUT_COMPLETION, type CheckoutCompletion } from '@/lib/subscriptions/checkout-completion';
import { CHECKOUT_COMPLETION_IGNORED } from '@/lib/webhooks/checkout-completion-ignored';
import type { IgnoredReason } from '@/lib/webhooks/ignored-reason';

export const ignoredCompletion = (
  logger: Pick<Logger, 'warn'>,
  reason: IgnoredReason,
  context: Record<string, unknown>,
): CheckoutCompletion => {
  logger.warn({ reason, ...context }, CHECKOUT_COMPLETION_IGNORED);
  return CHECKOUT_COMPLETION.HANDLED;
};
