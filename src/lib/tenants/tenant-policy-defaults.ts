export const TENANT_POLICY_DEFAULTS = {
  checkoutTtlHours: 12,
  resumeAllowed: true,
  graceEntitlement: true,
  dunningScheduleDays: [1, 3, 7],
} as const;
