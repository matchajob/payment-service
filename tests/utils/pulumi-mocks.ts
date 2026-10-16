import * as pulumi from '@pulumi/pulumi';
import { RESOURCE_TYPE } from '@tests/utils/pulumi-resource-types';

export type RecordedResource = { type: string; name: string; inputs: Record<string, unknown> };

export const MOCK_PROJECT = 'payment-service-test';
export const MOCK_REGION = 'me-west1';
const MOCK_STACK = 'test';
const MOCK_PREVIEW = true;

export const mockId = (name: string) => `${name}-id`;
export const mockAccountEmail = (accountId: string) => `${accountId}@${MOCK_PROJECT}.iam.gserviceaccount.com`;
export const mockMember = (email: string) => `serviceAccount:${email}`;
export const mockServiceUri = (name: string) => `https://${name}.run.app`;

const computedState = (type: string, inputs: Record<string, unknown>): Record<string, unknown> => {
  switch (type) {
    case RESOURCE_TYPE.account: {
      const email = mockAccountEmail(String(inputs['accountId']));
      return { email, member: mockMember(email) };
    }
    case RESOURCE_TYPE.cloudRunService:
      return { uri: mockServiceUri(String(inputs['name'])) };
    case RESOURCE_TYPE.databaseInstance:
      return { connectionName: `${MOCK_PROJECT}:${MOCK_REGION}:${String(inputs['name'])}` };
    default:
      return {};
  }
};

export const installPulumiMocks = (): RecordedResource[] => {
  const recorded: RecordedResource[] = [];
  pulumi.runtime.setMocks(
    {
      newResource: (args) => {
        recorded.push({ type: args.type, name: args.name, inputs: args.inputs });
        const id = mockId(args.name);
        return {
          id,
          state: {
            ...args.inputs,
            id,
            name: args.inputs['name'] ?? args.name,
            ...computedState(args.type, args.inputs),
          },
        };
      },
      call: (args) => args.inputs,
    },
    MOCK_PROJECT,
    MOCK_STACK,
    MOCK_PREVIEW,
  );
  return recorded;
};

export const resolveOutput = <T>(output: pulumi.Output<T>): Promise<T> =>
  new Promise((resolve) => output.apply(resolve));

export const ofType = (recorded: RecordedResource[], type: string) => recorded.filter((r) => r.type === type);
