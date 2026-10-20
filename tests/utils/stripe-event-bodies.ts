import { STRIPE_SESSION_ID } from '@tests/utils/stripe-session-replies';

export const CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed';

export const stripeEventBody = (type: string, object: object): string =>
  JSON.stringify({ id: 'evt_1FakeEvent01', object: 'event', type, livemode: false, data: { object } });

export const checkoutCompletedBody = (reference: string | null, sessionId: string = STRIPE_SESSION_ID): string =>
  stripeEventBody(CHECKOUT_SESSION_COMPLETED, {
    id: sessionId,
    object: 'checkout.session',
    status: 'complete',
    client_reference_id: reference,
  });
