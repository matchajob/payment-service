import type { CapturingLogger } from '@tests/utils/capturing-logger';
import { CHECKOUT_COMPLETION_IGNORED } from '@/lib/webhooks/checkout-completion-ignored';
import { WEBHOOK_IGNORED } from '@/lib/webhooks/webhook-ignored';

export const ignoredLines = (log: CapturingLogger) =>
  log.lines().filter(({ msg }) => msg === WEBHOOK_IGNORED || msg === CHECKOUT_COMPLETION_IGNORED);
