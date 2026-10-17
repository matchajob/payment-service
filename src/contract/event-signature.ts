export const SIGNATURE_HEADER = 'Payments-Signature';
export const TIMESTAMP_HEADER = 'Payments-Timestamp';
export const EVENT_TOLERANCE_SECONDS = 300;

export const signedPayload = (timestamp: number, body: string): string => `${timestamp}.${body}`;
