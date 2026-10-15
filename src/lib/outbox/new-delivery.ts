import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';

export const NO_ATTEMPTS = 0;

export const newDelivery = (dueAt: Date) => ({
  deliveryStatus: DELIVERY_STATUS.PENDING,
  attempts: NO_ATTEMPTS,
  nextAttemptAt: dueAt,
});
