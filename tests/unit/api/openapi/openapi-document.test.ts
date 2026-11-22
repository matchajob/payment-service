import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '@/api/openapi/build-openapi-document';
import { z } from 'zod';
import { outboundEventSchema } from '@/contract/outbound-event';
import { problemSchema } from '@/contract/problem';
import { publicCustomerSchema } from '@/contract/public-customer';
import { publicPlanSchema } from '@/contract/public-plan';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const UNAUTHORIZED = '401';
const POST = 'post';

type JsonObject = { [key: string]: unknown };

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const document = buildOpenApiDocument();

const operations = Object.entries(document.paths).flatMap(([path, item]) =>
  Object.entries(item).map(([method, operation]) => ({ name: `${method.toUpperCase()} ${path}`, method, operation })),
);

const undescribedProperties = (schema: unknown, at: string): string[] => {
  if (Array.isArray(schema)) return schema.flatMap((item, index) => undescribedProperties(item, `${at}[${index}]`));
  if (!isObject(schema)) return [];
  const own = isObject(schema.properties)
    ? Object.entries(schema.properties)
        .filter(
          ([, property]) => isObject(property) && property.description === undefined && property.$ref === undefined,
        )
        .map(([name]) => `${at}.${name}`)
    : [];
  return [...own, ...Object.entries(schema).flatMap(([key, value]) => undescribedProperties(value, `${at}.${key}`))];
};

describe('the OpenAPI document', () => {
  it.each(operations.filter((o) => o.method === POST))('$name requires an Idempotency-Key header', ({ operation }) => {
    expect(operation.parameters).toContainEqual(
      expect.objectContaining({ name: IDEMPOTENCY_HEADER, in: 'header', required: true }),
    );
  });

  it.each(operations)('$name documents a summary, a description and the 401 for a bad key', ({ operation }) => {
    expect(operation.summary).toEqual(expect.any(String));
    expect(operation.description).toEqual(expect.any(String));
    expect(Object.keys(operation.responses)).toContain(UNAUTHORIZED);
  });

  it('has a webhook entry for every event type the contract can send', () => {
    expect(Object.keys(document.webhooks).sort()).toEqual([...outboundEventSchema.shape.type.options].sort());
  });

  it.each(Object.entries(document.components.schemas))('the %s object lists its own properties', (_, schema) => {
    expect(Object.keys(schema.properties ?? {})).not.toEqual([]);
  });

  it('describes every property of every schema it publishes', () => {
    expect(undescribedProperties(document, '#')).toEqual([]);
  });
});

describe('published examples', () => {
  const PUBLISHED = {
    Plan: publicPlanSchema,
    Customer: publicCustomerSchema,
    Subscription: subscriptionSnapshotSchema,
    Event: outboundEventSchema,
    Problem: problemSchema,
  };

  it.each(Object.entries(PUBLISHED))(
    'the %s object carries a whole-object example that its own schema accepts',
    (id, schema) => {
      const examples: unknown = z.globalRegistry.get(schema)?.examples;
      expect(Array.isArray(examples), `${id} has no example`).toBe(true);
      for (const example of Array.isArray(examples) ? examples : []) {
        expect(schema.safeParse(example).error).toBeUndefined();
      }
    },
  );
});
