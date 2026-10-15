export const DELIVERY_STATUS = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  DEAD: 'dead',
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];
