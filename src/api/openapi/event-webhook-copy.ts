import type { outboundEventSchema } from '@/contract/outbound-event';

export type EventType = (typeof outboundEventSchema.shape.type.options)[number];

export const EVENT_WEBHOOK_COPY: Record<EventType, { summary: string; description: string }> = {
  'subscription.activated': {
    summary: 'The first payment succeeded',
    description:
      'Sent once per subscription, when the first charge succeeds after checkout. The subscription is now `active` and `entitled`, and `currentPeriodEnd` is set.',
  },
  'subscription.past_due': {
    summary: 'A renewal failed and retries started',
    description:
      'Sent after the `charge.failed` of the first failed renewal. Retries now run on your schedule. `entitled` follows your grace policy.',
  },
  'subscription.canceled': {
    summary: 'The subscription ended',
    description:
      'Sent when an `active` or `past_due` subscription ends: a canceled subscription reached its period end, you canceled it while `past_due`, the last retry failed, or a second paid checkout lost to a live subscription. `cancelReason` says which. A subscription that never activated (checkout expired, or canceled while `incomplete`) ends without this event. A declined first payment sends only `charge.failed`, with the snapshot already `canceled` and `cancelReason` set to `payment_failure`.',
  },
  'charge.succeeded': {
    summary: 'A renewal or a retry succeeded',
    description:
      'Sent for every successful renewal, scheduled retry and card-update retry. The period has moved on: `currentPeriodEnd` is the new end. The first payment sends `subscription.activated` instead.',
  },
  'charge.failed': {
    summary: 'A charge was declined',
    description:
      'Sent for every declined charge: the first payment, a renewal, each retry, and a card-update retry. Use it to nudge the customer to update their card.',
  },
};
