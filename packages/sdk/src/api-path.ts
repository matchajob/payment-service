export const API_PATH = {
  PLANS: '/v1/plans',
  CUSTOMERS: '/v1/customers',
  SUBSCRIPTIONS: '/v1/subscriptions',
} as const;

export const pathWithId = (base: string, id: string, action?: string): string => {
  const resource = `${base}/${encodeURIComponent(id)}`;
  return action === undefined ? resource : `${resource}/${action}`;
};
