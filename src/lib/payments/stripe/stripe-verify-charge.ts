import type { PaymentProvider, VerifiedCharge } from '@/lib/payments/provider';
import type { StripeContext } from '@/lib/payments/stripe/stripe-context';
import { stripeDataOf } from '@/lib/payments/stripe/stripe-data-of';
import {
  type StripePaymentIntent,
  zPaymentIntent,
  zPaymentIntentSearch,
} from '@/lib/payments/stripe/stripe-payment-intent';
import { STRIPE_FIELD, STRIPE_METADATA_KEY, STRIPE_PATH } from '@/lib/payments/stripe/stripe-wire-values';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { verifiedFromIntent } from '@/lib/payments/stripe/verified-from-intent';

const NO_QUERY = [] as const;
const SEARCH_SPECIAL = /[\\']/g;
const SEARCH_ESCAPE = '\\';
const OTHER_CHARGE = 'stripe returned a PaymentIntent for another dedup key';

const searchFor = (dedupKey: string): string =>
  `metadata['${STRIPE_METADATA_KEY.DEDUP_KEY}']:'${dedupKey.replace(SEARCH_SPECIAL, (special) => `${SEARCH_ESCAPE}${special}`)}'`;

const ours = (intent: StripePaymentIntent, dedupKey: string): VerifiedCharge => {
  if (intent.metadata[STRIPE_METADATA_KEY.DEDUP_KEY] !== dedupKey) throw new Error(OTHER_CHARGE);
  return verifiedFromIntent(intent);
};

const byRef = async ({ client }: StripeContext, providerChargeRef: string, dedupKey: string) => {
  const path = `${STRIPE_PATH.PAYMENT_INTENTS}/${encodeURIComponent(providerChargeRef)}`;
  return ours(stripeDataOf(path, await client.get(path, NO_QUERY), zPaymentIntent), dedupKey);
};

const byDedupKey = async ({ client }: StripeContext, dedupKey: string): Promise<VerifiedCharge> => {
  const reply = await client.get(STRIPE_PATH.PAYMENT_INTENTS_SEARCH, [[STRIPE_FIELD.QUERY, searchFor(dedupKey)]]);
  const [intent] = stripeDataOf(STRIPE_PATH.PAYMENT_INTENTS_SEARCH, reply, zPaymentIntentSearch).data;
  return intent === undefined ? { outcome: VERIFY_OUTCOME.NOT_FOUND } : ours(intent, dedupKey);
};

export const stripeVerifyCharge =
  (context: StripeContext): PaymentProvider['verifyCharge'] =>
  ({ providerChargeRef, dedupKey }) =>
    providerChargeRef === null ? byDedupKey(context, dedupKey) : byRef(context, providerChargeRef, dedupKey);
