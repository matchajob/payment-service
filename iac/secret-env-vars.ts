import type { declareRuntimeSecrets } from '@iac/runtime-secrets';

const LATEST_VERSION = 'latest';

export const secretEnvVars = (secrets: ReturnType<typeof declareRuntimeSecrets>) =>
  secrets.map(({ env, secret }) => ({
    name: env,
    valueSource: { secretKeyRef: { secret: secret.secretId, version: LATEST_VERSION } },
  }));
