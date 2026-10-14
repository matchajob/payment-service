import type { IdempotencyKeyRow } from '@/lib/idempotency/schema';

export type StoredResponse = { status: number; contentType: string; body: string };

export const toStoredResponse = ({
  responseStatus,
  responseContentType,
  responseBody,
}: IdempotencyKeyRow): StoredResponse | undefined =>
  responseStatus === null || responseContentType === null || responseBody === null
    ? undefined
    : { status: responseStatus, contentType: responseContentType, body: responseBody };
