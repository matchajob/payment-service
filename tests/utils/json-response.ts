import { UPSTREAM_HTTP_STATUS } from '@tests/utils/upstream-http-status';

const CONTENT_TYPE_HEADER = 'content-type';
const JSON_CONTENT_TYPE = 'application/json';

export const jsonResponse = (body: unknown, status: number = UPSTREAM_HTTP_STATUS.OK) =>
  new Response(JSON.stringify(body), { status, headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE } });
