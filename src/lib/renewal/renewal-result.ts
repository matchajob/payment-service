export const RENEWAL_RESULT = {
  RENEWED: 'renewed',
  CANCELED: 'canceled',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;

export type RenewalResult = (typeof RENEWAL_RESULT)[keyof typeof RENEWAL_RESULT];
