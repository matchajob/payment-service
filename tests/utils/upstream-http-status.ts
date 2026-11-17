import { HTTP_STATUS } from '@/api/http-status';

export const UPSTREAM_HTTP_STATUS = { ...HTTP_STATUS, FORBIDDEN: 403, SERVICE_UNAVAILABLE: 503 } as const;
