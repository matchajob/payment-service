export const chargeDedupKey = (subscriptionId: string, periodEnd: Date, attempt: number): string =>
  `${subscriptionId}:${periodEnd.toISOString()}:${attempt}`;
