export const API_TAG = {
  PLANS: 'Plans',
  CUSTOMERS: 'Customers',
  SUBSCRIPTIONS: 'Subscriptions',
  CHARGES: 'Charges',
  EVENTS: 'Events',
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
  {
    name: API_TAG.CHARGES,
    description:
      'A charge is one attempt to take money for a subscription: the checkout payment, a renewal or a retry. Charges are read-only: the service creates them on schedule.',
  },
  {
    name: API_TAG.EVENTS,
    description:
      'Every event sent to your webhook URL, with the state of its delivery. An event whose retries ran out is `dead`. Fix your endpoint, then redrive it.',
  },
];
