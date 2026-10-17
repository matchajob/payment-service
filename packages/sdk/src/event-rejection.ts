export const EVENT_REJECTION = {
  INVALID_HEADERS: 'invalid_headers',
  STALE_TIMESTAMP: 'stale_timestamp',
  BAD_SIGNATURE: 'bad_signature',
  MALFORMED_EVENT: 'malformed_event',
} as const;

export type EventRejection = (typeof EVENT_REJECTION)[keyof typeof EVENT_REJECTION];
