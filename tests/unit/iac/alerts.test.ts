import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SERVICE_NAME } from '@iac/cloud-run-service';
import { REQUIRED_APIS } from '@iac/required-apis';
import { CRON_BUDGET_SPENT } from '@/lib/cron/for-each-within-budget';
import { installPulumiMocks, ofType, resolveOutput, type RecordedResource } from '@tests/utils/pulumi-mocks';
import { RESOURCE_TYPE } from '@tests/utils/pulumi-resource-types';
import { TEST_STACK_SETTINGS } from '@tests/utils/pulumi-test-settings';

const EMAIL_CHANNEL = 'email';
const PINO_ERROR_LEVEL = 50;
const SCHEDULER_RESOURCE = 'resource.type="cloud_scheduler_job"';
const ERROR_SEVERITY = 'severity>=ERROR';
const MONITORING_API = 'monitoring.googleapis.com';
const LOGGING_API = 'logging.googleapis.com';

const channelSchema = z.object({ type: z.string(), labels: z.object({ email_address: z.string() }) });
const policySchema = z.object({
  displayName: z.string(),
  notificationChannels: z.array(z.string()),
  alertStrategy: z.object({ notificationRateLimit: z.object({ period: z.string() }) }),
  conditions: z.array(z.object({ conditionMatchedLog: z.object({ filter: z.string() }) })).length(1),
  documentation: z.object({ content: z.string() }),
});

const recorded: RecordedResource[] = installPulumiMocks();

const channels = () => ofType(recorded, RESOURCE_TYPE.notificationChannel).map((r) => channelSchema.parse(r.inputs));
const policies = () => ofType(recorded, RESOURCE_TYPE.alertPolicy).map((r) => policySchema.parse(r.inputs));
const filters = () => policies().map((policy) => policy.conditions[0]!.conditionMatchedLog.filter);

describe('alerts (production basics step 6)', () => {
  beforeAll(async () => {
    const { declarePaymentServiceStack } = await import('@iac/payment-service-stack');
    const stack = declarePaymentServiceStack(TEST_STACK_SETTINGS);
    await resolveOutput(stack.serviceUrl);
  });

  it('enables the Monitoring and Logging APIs the alerts need', () => {
    expect(REQUIRED_APIS).toEqual(expect.arrayContaining([MONITORING_API, LOGGING_API]));
  });

  it('sends to one email channel, addressed from stack config, never from code', () => {
    expect(channels()).toEqual([{ type: EMAIL_CHANNEL, labels: { email_address: TEST_STACK_SETTINGS.alertEmail } }]);
  });

  it('routes every alert to that channel, rate-limited, with what to do written on it', () => {
    expect(policies().length).toBeGreaterThan(0);
    policies().forEach((policy) => {
      expect(policy.notificationChannels).toHaveLength(1);
      expect(policy.alertStrategy.notificationRateLimit.period).not.toBe('');
      expect(policy.documentation.content).not.toBe('');
    });
  });

  it('alerts when a Scheduler run fails, which is how a cron answering 500 shows up (ADR 0026)', () => {
    expect(filters()).toContainEqual(expect.stringContaining(SCHEDULER_RESOURCE));
    expect(filters().find((filter) => filter.includes(SCHEDULER_RESOURCE))).toContain(ERROR_SEVERITY);
  });

  it("alerts on any error this service logs, which includes dead letters (code-review-1 M23), and on Cloud Run's own errors", () => {
    const serviceErrors = filters().find((filter) => filter.includes(`jsonPayload.level>=${PINO_ERROR_LEVEL}`));
    expect(serviceErrors).toContain(`resource.labels.service_name="${SERVICE_NAME}"`);
    expect(serviceErrors).toContain(ERROR_SEVERITY);
  });

  it('alerts when a cron leaves work for the next run, so a backlog that never clears is seen', () => {
    expect(filters()).toContainEqual(expect.stringContaining(`jsonPayload.msg="${CRON_BUDGET_SPENT}"`));
  });
});
