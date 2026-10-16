import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RUNTIME_SECRET_ENV } from '@iac/runtime-secret-env';
import type { StackSettings } from '@iac/stack-settings';
import { ENV } from '@/lib/env-names';
import {
  MOCK_PROJECT,
  MOCK_REGION,
  installPulumiMocks,
  mockAccountEmail,
  mockId,
  mockMember,
  mockServiceUri,
  ofType,
  resolveOutput,
  type RecordedResource,
} from '@tests/utils/pulumi-mocks';
import { RESOURCE_TYPE } from '@tests/utils/pulumi-resource-types';

const envVarSchema = z.object({
  name: z.string(),
  value: z.string().optional(),
  valueSource: z.object({ secretKeyRef: z.object({ secret: z.string(), version: z.string() }) }).optional(),
});
const serviceInputsSchema = z.object({
  template: z.object({
    serviceAccount: z.string(),
    containers: z.array(z.object({ envs: z.array(envVarSchema) })).length(1),
  }),
});
const jobInputsSchema = z.object({
  httpTarget: z.object({
    uri: z.string(),
    httpMethod: z.string(),
    headers: z.record(z.string(), z.string()).default({}),
    oidcToken: z.object({ serviceAccountEmail: z.string(), audience: z.string() }).optional(),
  }),
});
const databaseInstanceInputsSchema = z.object({
  deletionProtection: z.boolean(),
  settings: z.object({
    backupConfiguration: z.object({ enabled: z.boolean(), pointInTimeRecoveryEnabled: z.boolean() }),
  }),
});

const SETTINGS: StackSettings = {
  project: MOCK_PROJECT,
  region: MOCK_REGION,
  environment: 'staging',
  image: 'example.invalid/payment-service:test',
  githubRepository: 'example/payment-service',
  databaseTier: 'db-f1-micro',
  maxInstances: 2,
};

const CRON_PATH_PREFIX = '/internal/cron/';
const PROVIDER_CREDENTIALS_KEY_ID = mockId('provider-credentials');

const recorded: RecordedResource[] = installPulumiMocks();

const only = (type: string) => {
  const matches = ofType(recorded, type);
  expect(matches).toHaveLength(1);
  return matches[0]!;
};

const serviceInputs = () => serviceInputsSchema.parse(only(RESOURCE_TYPE.cloudRunService).inputs);
const runtimeMember = () => mockMember(serviceInputs().template.serviceAccount);
const containerEnv = () => serviceInputs().template.containers[0]!.envs;
const envValue = (name: string) => containerEnv().find((e) => e.name === name)?.value;
const schedulerTargets = () =>
  ofType(recorded, RESOURCE_TYPE.schedulerJob).map((job) => jobInputsSchema.parse(job.inputs).httpTarget);

describe('payment service stack (slice 0.6)', () => {
  beforeAll(async () => {
    const { declarePaymentServiceStack } = await import('@iac/payment-service-stack');
    const outputs = declarePaymentServiceStack(SETTINGS);
    await resolveOutput(outputs.cronJobNames);
    await resolveOutput(outputs.serviceUrl);
  });

  describe('secrets', () => {
    it('reads every runtime secret from Secret Manager, never as a plain value', () => {
      for (const name of RUNTIME_SECRET_ENV) {
        const entry = containerEnv().find((e) => e.name === name);
        expect(entry?.value).toBeUndefined();
        expect(entry?.valueSource?.secretKeyRef.secret).toBeTruthy();
      }
    });

    it('declares no secret versions, so no secret value enters the stack state', () => {
      expect(ofType(recorded, RESOURCE_TYPE.secretVersion)).toHaveLength(0);
    });

    it('declares no Cloud SQL user, whose password would land in state', () => {
      expect(ofType(recorded, RESOURCE_TYPE.sqlUser)).toHaveLength(0);
    });

    it('lets the runtime service account read each runtime secret and nothing broader', () => {
      const grants = ofType(recorded, RESOURCE_TYPE.secretIamMember);
      expect(grants).toHaveLength(RUNTIME_SECRET_ENV.length);
      for (const grant of grants) {
        expect(grant.inputs['role']).toBe('roles/secretmanager.secretAccessor');
        expect(grant.inputs['member']).toBe(runtimeMember());
      }
    });
  });

  describe('cron (ADR 0002, amended by ADR 0012)', () => {
    it('targets only /internal/cron/* on the service, with POST', () => {
      const targets = schedulerTargets();
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        expect(target.uri.startsWith(`${mockServiceUri('payment-service')}${CRON_PATH_PREFIX}`)).toBe(true);
        expect(target.httpMethod).toBe('POST');
      }
    });

    it('signs every job with an OIDC token from the cron invoker, for the audience the service expects', () => {
      const invoker = envValue(ENV.CRON_INVOKER_EMAIL);
      const audience = envValue(ENV.CRON_AUDIENCE);
      expect(invoker).toBe(mockAccountEmail('cron-invoker'));
      expect(audience).toBeTruthy();
      for (const target of schedulerTargets()) {
        expect(target.oidcToken).toEqual({ serviceAccountEmail: invoker, audience });
      }
    });

    it('carries no Authorization header, so no shared secret sits in Scheduler config', () => {
      for (const target of schedulerTargets()) {
        expect(Object.keys(target.headers).map((h) => h.toLowerCase())).not.toContain('authorization');
      }
    });

    it('no longer passes CRON_SECRET to the service', () => {
      expect(containerEnv().map((e) => e.name)).not.toContain(ENV.CRON_SECRET);
    });
  });

  describe('provider credentials key (ADR 0010, slice 19)', () => {
    it('declares one symmetric key with rotation', () => {
      const key = only(RESOURCE_TYPE.cryptoKey);
      expect(key.inputs['purpose']).toBe('ENCRYPT_DECRYPT');
      expect(key.inputs['rotationPeriod']).toBeTruthy();
    });

    it('gives the runtime service account encrypt and decrypt on that key only', () => {
      const grant = only(RESOURCE_TYPE.cryptoKeyIamMember);
      expect(grant.inputs['role']).toBe('roles/cloudkms.cryptoKeyEncrypterDecrypter');
      expect(grant.inputs['member']).toBe(runtimeMember());
      expect(grant.inputs['cryptoKeyId']).toBe(PROVIDER_CREDENTIALS_KEY_ID);
    });

    it('tells the service the key name as a plain value', () => {
      expect(envValue(ENV.PROVIDER_CREDENTIALS_KMS_KEY)).toBe(PROVIDER_CREDENTIALS_KEY_ID);
    });
  });

  describe('database', () => {
    it('protects the instance from deletion and keeps point-in-time backups', () => {
      const instance = databaseInstanceInputsSchema.parse(only(RESOURCE_TYPE.databaseInstance).inputs);
      expect(instance.deletionProtection).toBe(true);
      expect(instance.settings.backupConfiguration.enabled).toBe(true);
      expect(instance.settings.backupConfiguration.pointInTimeRecoveryEnabled).toBe(true);
    });
  });

  describe('service', () => {
    it('runs as its own service account, not the default compute one', () => {
      expect(serviceInputs().template.serviceAccount).toBe(mockAccountEmail('payment-service-runtime'));
    });
  });
});
