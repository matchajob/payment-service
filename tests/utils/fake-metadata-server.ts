import { jsonResponse } from '@tests/utils/json-response';
import { UPSTREAM_HTTP_STATUS } from '@tests/utils/upstream-http-status';

const METADATA_FLAVOR_HEADER = 'metadata-flavor';
const METADATA_FLAVOR = 'Google';
const TOKEN_TYPE = 'Bearer';

export const METADATA_HOST = 'metadata.google.internal';
export const FAKE_TOKEN_LIFETIME_SECONDS = 3599;

export type FakeMetadataServer = {
  handle: (request: Request) => Response;
  latestToken: () => string | undefined;
  tokensIssued: () => number;
};

export const fakeMetadataServer = (): FakeMetadataServer => {
  const issued: string[] = [];
  return {
    handle: (request) => {
      if (request.headers.get(METADATA_FLAVOR_HEADER) !== METADATA_FLAVOR) {
        return jsonResponse({}, UPSTREAM_HTTP_STATUS.FORBIDDEN);
      }
      issued.push(`fake-access-token-${issued.length + 1}`);
      return jsonResponse({
        access_token: issued.at(-1),
        expires_in: FAKE_TOKEN_LIFETIME_SECONDS,
        token_type: TOKEN_TYPE,
      });
    },
    latestToken: () => issued.at(-1),
    tokensIssued: () => issued.length,
  };
};
