export const IGNORED_REASON = {
  UNRECOGNIZED_PAYLOAD: 'unrecognized_payload',
  UNKNOWN_SUBSCRIPTION: 'unknown_subscription',
  NOT_AWAITING_CHECKOUT: 'not_awaiting_checkout',
  SESSION_MISMATCH: 'session_mismatch',
  CARD_UPDATE_IGNORED: 'card_update_ignored',
} as const;

export type IgnoredReason = (typeof IGNORED_REASON)[keyof typeof IGNORED_REASON];
