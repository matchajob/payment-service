import { planListResponseSchema } from '@/contract/plan-list-response';
import { API_PATH } from '@sdk/api-path';
import { HTTP_METHOD } from '@sdk/http-method';
import type { Requester } from '@sdk/request';

export const plansResource = (request: Requester) => ({
  list: async () =>
    (await request({ method: HTTP_METHOD.GET, path: API_PATH.PLANS, response: planListResponseSchema })).data,
});
