import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import { RUNTIME_SECRET_ENV, type RuntimeSecretEnv } from '@iac/runtime-secret-env';
import type { StackSettings } from '@iac/stack-settings';

const SECRET_ACCESSOR_ROLE = 'roles/secretmanager.secretAccessor';
const ENV_WORD_SEPARATOR = '_';
const SECRET_ID_WORD_SEPARATOR = '-';

const secretId = (env: RuntimeSecretEnv) => env.toLowerCase().replaceAll(ENV_WORD_SEPARATOR, SECRET_ID_WORD_SEPARATOR);

export const declareRuntimeSecrets = (
  settings: StackSettings,
  runtime: gcp.serviceaccount.Account,
  opts: pulumi.CustomResourceOptions,
) =>
  RUNTIME_SECRET_ENV.map((env) => {
    const secret = new gcp.secretmanager.Secret(
      secretId(env),
      { project: settings.project, secretId: secretId(env), replication: { auto: {} } },
      { ...opts, protect: true },
    );
    new gcp.secretmanager.SecretIamMember(
      `${secretId(env)}-runtime-accessor`,
      {
        project: settings.project,
        secretId: secret.secretId,
        role: SECRET_ACCESSOR_ROLE,
        member: runtime.member,
      },
      opts,
    );
    return { env, secret };
  });
