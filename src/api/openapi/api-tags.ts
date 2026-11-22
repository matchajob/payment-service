export const API_TAG = {
  PLANS: 'Plans',
  CUSTOMERS: 'Customers',
  SUBSCRIPTIONS: 'Subscriptions',
} as const;

export const API_TAG_DESCRIPTIONS = [
  {
    name: API_TAG.PLANS,
    description:
      'A plan is a price: an amount, a currency and an interval. Plans never change after they are created, so a price change is a new plan and existing subscribers keep theirs until you move them.',
  },
  {
    name: API_TAG.CUSTOMERS,
    description:
      'A customer is one of your users, identified by your own `externalRef`. Create one before its first subscription. A customer outlives its subscriptions, and its optional billing details go on tax invoices.',
  },
  {
    name: API_TAG.SUBSCRIPTIONS,
    description:
      'A subscription bills one customer for one plan on the anniversary of the first payment. Its status moves through a fixed lifecycle: `incomplete`, `active`, `past_due`, `canceled`. Every read and command returns the same Subscription object that events carry. Grant access from `entitled`.',
  },
];
