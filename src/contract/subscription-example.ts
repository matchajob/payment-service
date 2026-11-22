import { EXAMPLE } from '@/contract/contract-examples';

export const SUBSCRIPTION_EXAMPLE = {
  subscriptionId: EXAMPLE.SUBSCRIPTION_ID,
  customerId: EXAMPLE.CUSTOMER_ID,
  customerExternalRef: EXAMPLE.EXTERNAL_REF,
  planId: EXAMPLE.PLAN_ID,
  status: 'active',
  entitled: true,
  currentPeriodEnd: EXAMPLE.PERIOD_END,
  cancelAtPeriodEnd: false,
  cancelReason: null,
  canceledAt: null,
} as const;
