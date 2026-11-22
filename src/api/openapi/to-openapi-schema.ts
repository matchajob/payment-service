import { z, type ZodType } from 'zod';
import type { JsonSchema } from '@/api/openapi/openapi-types';

const COMPONENTS_PREFIX = '#/components/schemas/';
const LOCAL_DEFS_REF = /"#\/\$defs\//g;
const jsonObjectSchema = z.record(z.string(), z.unknown());

type Io = 'input' | 'output';

const dropValidatorNoise = ({ jsonSchema }: { jsonSchema: JsonSchema }) => {
  if (jsonSchema.format !== undefined) delete jsonSchema.pattern;
  if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum;
  if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) delete jsonSchema.minimum;
  delete jsonSchema.additionalProperties;
};

const withoutDialect = ({ $schema: _dialect, $id: _id, ...schema }: JsonSchema): JsonSchema => schema;

export const componentRef = (id: string): JsonSchema => ({ $ref: `${COMPONENTS_PREFIX}${id}` });

export const toOpenApiSchema = (schema: ZodType, io: Io): JsonSchema => {
  const { $defs: _components, ...rest } = withoutDialect(z.toJSONSchema(schema, { io, override: dropValidatorNoise }));
  return jsonObjectSchema.parse(JSON.parse(JSON.stringify(rest).replace(LOCAL_DEFS_REF, `"${COMPONENTS_PREFIX}`)));
};

export const toOpenApiComponents = (ids: readonly string[]): Record<string, JsonSchema> => {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    io: 'output',
    override: dropValidatorNoise,
    uri: (id) => `${COMPONENTS_PREFIX}${id}`,
  });
  return Object.fromEntries(
    ids.map((id) => {
      const schema = schemas[id];
      if (schema === undefined) throw new Error(`no contract schema carries the id ${id}`);
      return [id, withoutDialect(schema)];
    }),
  );
};
