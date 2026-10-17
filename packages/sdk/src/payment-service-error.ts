import type { Problem } from '@/contract/problem';

const ERROR_NAME = 'PaymentServiceError';

export class PaymentServiceError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail === undefined ? problem.title : `${problem.title}: ${problem.detail}`);
    this.name = ERROR_NAME;
    this.status = problem.status;
    this.problem = problem;
  }
}
