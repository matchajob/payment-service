import { z, type ZodType } from 'zod';
import { toOpenApiComponents } from '@/api/openapi/to-openapi-schema';
import { outboundEventSchema } from '@/contract/outbound-event';
import { eventDeliverySchema } from '@/contract/event-delivery';
import { problemSchema } from '@/contract/problem';
import { publicChargeSchema } from '@/contract/public-charge';
import { publicCustomerSchema } from '@/contract/public-customer';
import { publicPlanSchema } from '@/contract/public-plan';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';

const PUBLISHED_OBJECTS: readonly ZodType[] = [
  publicPlanSchema,
  publicCustomerSchema,
  subscriptionSnapshotSchema,
  outboundEventSchema,
  publicChargeSchema,
  eventDeliverySchema,
  problemSchema,
];

const idOf = (schema: ZodType): string => {
  const id = z.globalRegistry.get(schema)?.id;
  if (id === undefined) throw new Error('a published object needs an id in its contract meta');
  return id;
};

export const componentSchemas = () => toOpenApiComponents(PUBLISHED_OBJECTS.map(idOf));
