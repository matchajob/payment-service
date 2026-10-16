import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import type { StackSettings } from '@iac/stack-settings';

const KEY_RING_NAME = 'payment-service';
const KEY_NAME = 'provider-credentials';
const ENCRYPTER_DECRYPTER_ROLE = 'roles/cloudkms.cryptoKeyEncrypterDecrypter';
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

export const declareProviderCredentialsKey = (
  settings: StackSettings,
  runtime: gcp.serviceaccount.Account,
  opts: pulumi.CustomResourceOptions,
) => {
  const keyRing = new gcp.kms.KeyRing(
    KEY_RING_NAME,
    { project: settings.project, location: settings.region, name: KEY_RING_NAME },
    { ...opts, protect: true },
  );
  const key = new gcp.kms.CryptoKey(
    KEY_NAME,
    {
      keyRing: keyRing.id,
      name: KEY_NAME,
      purpose: 'ENCRYPT_DECRYPT',
      rotationPeriod: `${NINETY_DAYS_SECONDS}s`,
    },
    { ...opts, protect: true },
  );
  new gcp.kms.CryptoKeyIAMMember(
    'provider-credentials-runtime',
    { cryptoKeyId: key.id, role: ENCRYPTER_DECRYPTER_ROLE, member: runtime.member },
    opts,
  );
  return key;
};
