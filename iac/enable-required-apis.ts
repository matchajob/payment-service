import * as gcp from '@pulumi/gcp';
import { REQUIRED_APIS } from '@iac/required-apis';

const API_HOST_SEPARATOR = '.';

const resourceName = (api: string) => api.split(API_HOST_SEPARATOR)[0]!;

export const enableRequiredApis = (project: string): gcp.projects.Service[] =>
  REQUIRED_APIS.map(
    (api) => new gcp.projects.Service(resourceName(api), { project, service: api, disableOnDestroy: false }),
  );
