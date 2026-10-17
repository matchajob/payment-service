import { problemSchema, type Problem } from '@/contract/problem';

const DEFAULT_TYPE = 'about:blank';

export const readProblem = async (response: Response): Promise<Problem> => {
  const parsed = problemSchema.safeParse(await response.json().catch(() => undefined));
  return parsed.success ? parsed.data : { type: DEFAULT_TYPE, title: response.statusText, status: response.status };
};
