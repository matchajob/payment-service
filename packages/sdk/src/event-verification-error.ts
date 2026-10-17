import type { EventRejection } from '@sdk/event-rejection';

const ERROR_NAME = 'EventVerificationError';

export class EventVerificationError extends Error {
  readonly reason: EventRejection;

  constructor(reason: EventRejection) {
    super(`event rejected: ${reason}`);
    this.name = ERROR_NAME;
    this.reason = reason;
  }
}
