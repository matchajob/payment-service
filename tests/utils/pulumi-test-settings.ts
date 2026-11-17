import type { StackSettings } from '@iac/stack-settings';
import { MOCK_PROJECT, MOCK_REGION } from '@tests/utils/pulumi-mocks';

export const TEST_STACK_SETTINGS: StackSettings = {
  project: MOCK_PROJECT,
  region: MOCK_REGION,
  environment: 'staging',
  image: 'example.invalid/payment-service:test',
  githubRepository: 'example/payment-service',
  databaseTier: 'db-f1-micro',
  maxInstances: 2,
};
