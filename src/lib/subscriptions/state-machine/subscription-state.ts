export type SubscriptionState =
    | { status: 'incomplete' }
    | { status: 'active'; cancelAtPeriodEnd: boolean }
    | { status: 'past_due' }
    | { status: 'canceled' }; //TODO type those strings into a dict

export const ACTIVE = { status: 'active', cancelAtPeriodEnd: false } satisfies SubscriptionState;
export const ACTIVE_FLAGGED = { status: 'active', cancelAtPeriodEnd: true } satisfies SubscriptionState;
export const PAST_DUE = { status: 'past_due' } satisfies SubscriptionState;
export const CANCELED = { status: 'canceled' } satisfies SubscriptionState;