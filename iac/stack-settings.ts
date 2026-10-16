import * as pulumi from '@pulumi/pulumi';
import { z } from 'zod';
import { ENVIRONMENTS } from '@iac/environments';

const PLACEHOLDER_IMAGE = 'us-docker.pkg.dev/cloudrun/container/hello';
const DEFAULT_DATABASE_TIER = 'db-f1-micro';
const DEFAULT_MAX_INSTANCES = 3;
const GCP_CONFIG_NAMESPACE = 'gcp';
const GITHUB_REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const stackSettingsSchema = z.object({
  project: z.string().min(1),
  region: z.string().min(1),
  environment: z.enum(ENVIRONMENTS),
  image: z.string().min(1).default(PLACEHOLDER_IMAGE),
  githubRepository: z.string().regex(GITHUB_REPOSITORY_PATTERN),
  databaseTier: z.string().min(1).default(DEFAULT_DATABASE_TIER),
  maxInstances: z.number().int().positive().default(DEFAULT_MAX_INSTANCES),
});

export type StackSettings = z.output<typeof stackSettingsSchema>;

export const readStackSettings = (): StackSettings => {
  const gcp = new pulumi.Config(GCP_CONFIG_NAMESPACE);
  const own = new pulumi.Config();
  return stackSettingsSchema.parse({
    project: gcp.require('project'),
    region: gcp.require('region'),
    environment: pulumi.getStack(),
    image: own.get('image'),
    githubRepository: own.require('githubRepository'),
    databaseTier: own.get('databaseTier'),
    maxInstances: own.getNumber('maxInstances'),
  });
};
