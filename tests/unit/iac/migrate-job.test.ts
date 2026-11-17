import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MIGRATE_COMMAND } from '@iac/migrate-command';
import { MIGRATE_JOB_NAME } from '@iac/migrate-job';
import { ENV } from '@/lib/env-names';
import {
  installPulumiMocks,
  mockAccountEmail,
  ofType,
  resolveOutput,
  type RecordedResource,
} from '@tests/utils/pulumi-mocks';
import { RESOURCE_TYPE } from '@tests/utils/pulumi-resource-types';
import { TEST_STACK_SETTINGS } from '@tests/utils/pulumi-test-settings';

const containerSchema = z.object({
  image: z.string(),
  commands: z.array(z.string()),
  envs: z.array(
    z.object({
      name: z.string(),
      value: z.string().optional(),
      valueSource: z.object({ secretKeyRef: z.object({ secret: z.string() }) }).optional(),
    }),
  ),
  volumeMounts: z.array(z.object({ name: z.string(), mountPath: z.string() })),
});
const runSchema = z.object({
  template: z.object({
    serviceAccount: z.string(),
    maxRetries: z.number(),
    volumes: z.array(z.object({ name: z.string(), cloudSqlInstance: z.object({ instances: z.array(z.string()) }) })),
    containers: z.array(containerSchema).length(1),
  }),
});
const jobSchema = z.object({ name: z.string(), template: z.object({ taskCount: z.number() }).and(runSchema) });
const serviceSchema = z.object({
  template: runSchema.shape.template
    .pick({ volumes: true })
    .extend({ containers: z.array(containerSchema.pick({ volumeMounts: true })).length(1) }),
});

const recorded: RecordedResource[] = installPulumiMocks();
const outputs: { migrateJobName?: string } = {};

const only = (type: string) => {
  const matches = ofType(recorded, type);
  expect(matches).toHaveLength(1);
  return matches[0]!.inputs;
};
const job = () => jobSchema.parse(only(RESOURCE_TYPE.cloudRunJob));
const jobContainer = () => job().template.template.containers[0]!;
const service = () => serviceSchema.parse(only(RESOURCE_TYPE.cloudRunService));

describe('migrate job (ADR 0025)', () => {
  beforeAll(async () => {
    const { declarePaymentServiceStack } = await import('@iac/payment-service-stack');
    const stack = declarePaymentServiceStack(TEST_STACK_SETTINGS);
    outputs.migrateJobName = await resolveOutput(stack.migrateJobName);
    await resolveOutput(stack.serviceUrl);
  });

  it('runs the same image as the service, so the schema always matches the code that ships with it', () => {
    expect(jobContainer().image).toBe(TEST_STACK_SETTINGS.image);
  });

  it("runs drizzle's migrator instead of the server", () => {
    expect(jobContainer().commands).toEqual([...MIGRATE_COMMAND]);
  });

  it('reads DATABASE_URL from Secret Manager, never as a plain value', () => {
    const databaseUrl = jobContainer().envs.find((e) => e.name === ENV.DATABASE_URL);
    expect(databaseUrl?.value).toBeUndefined();
    expect(databaseUrl?.valueSource?.secretKeyRef.secret).toBeTruthy();
  });

  it('runs as the runtime service account and mounts the same Cloud SQL instance as the service', () => {
    expect(job().template.template.serviceAccount).toBe(mockAccountEmail('payment-service-runtime'));
    expect(job().template.template.volumes).toEqual(service().template.volumes);
    expect(jobContainer().volumeMounts).toEqual(service().template.containers[0]!.volumeMounts);
  });

  it('runs one task and never retries a failed migration on its own, so CI sees the failure', () => {
    expect(job().template.taskCount).toBe(1);
    expect(job().template.template.maxRetries).toBe(0);
  });

  it('exports its name, so CI can run it before the service updates', () => {
    expect(outputs.migrateJobName).toBe(MIGRATE_JOB_NAME);
  });
});
