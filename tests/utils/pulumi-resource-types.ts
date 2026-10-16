export const RESOURCE_TYPE = {
  account: 'gcp:serviceaccount/account:Account',
  cloudRunService: 'gcp:cloudrunv2/service:Service',
  cryptoKey: 'gcp:kms/cryptoKey:CryptoKey',
  cryptoKeyIamMember: 'gcp:kms/cryptoKeyIAMMember:CryptoKeyIAMMember',
  databaseInstance: 'gcp:sql/databaseInstance:DatabaseInstance',
  projectIamMember: 'gcp:projects/iAMMember:IAMMember',
  schedulerJob: 'gcp:cloudscheduler/job:Job',
  secret: 'gcp:secretmanager/secret:Secret',
  secretIamMember: 'gcp:secretmanager/secretIamMember:SecretIamMember',
  secretVersion: 'gcp:secretmanager/secretVersion:SecretVersion',
  sqlUser: 'gcp:sql/user:User',
} as const;
