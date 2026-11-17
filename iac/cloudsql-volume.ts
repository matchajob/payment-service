import type * as pulumi from '@pulumi/pulumi';

const CLOUDSQL_VOLUME = 'cloudsql';
const CLOUDSQL_MOUNT_PATH = '/cloudsql';

export const cloudSqlVolumes = (connectionName: pulumi.Input<string>) => [
  { name: CLOUDSQL_VOLUME, cloudSqlInstance: { instances: [connectionName] } },
];

export const cloudSqlVolumeMounts = () => [{ name: CLOUDSQL_VOLUME, mountPath: CLOUDSQL_MOUNT_PATH }];
