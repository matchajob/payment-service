import { HTTP_STATUS } from '@/api/http-status';

export const PROBLEM_TITLE = {
  [HTTP_STATUS.BAD_REQUEST]: 'Bad Request',
  [HTTP_STATUS.UNAUTHORIZED]: 'Unauthorized',
  [HTTP_STATUS.NOT_FOUND]: 'Not Found',
  [HTTP_STATUS.CONFLICT]: 'Conflict',
  [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HTTP_STATUS.UNPROCESSABLE_CONTENT]: 'Unprocessable Content',
} as const;

export type ProblemStatus = keyof typeof PROBLEM_TITLE;
