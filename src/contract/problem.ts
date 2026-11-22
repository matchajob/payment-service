import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';

export const problemSchema = z
  .object({
    type: z.string().describe('A URI that identifies the problem type. about:blank for the standard HTTP problems.'),
    title: z.string().meta({ description: 'The HTTP status phrase.', examples: [EXAMPLE.PROBLEM_TITLE] }),
    status: z
      .int()
      .min(400)
      .max(599)
      .meta({ description: 'The HTTP status code.', examples: [EXAMPLE.PROBLEM_STATUS] }),
    detail: z
      .string()
      .optional()
      .meta({ description: 'What went wrong, often a machine-readable reason.', examples: [EXAMPLE.PROBLEM_DETAIL] }),
    instance: z.string().optional().describe('A URI for this occurrence of the problem, when there is one.'),
  })
  .meta({
    id: 'Problem',
    title: 'The Problem object',
    examples: [
      {
        type: 'about:blank',
        title: EXAMPLE.PROBLEM_TITLE,
        status: EXAMPLE.PROBLEM_STATUS,
        detail: EXAMPLE.PROBLEM_DETAIL,
      },
    ],
    description: 'Every error response is an RFC 9457 problem document served as application/problem+json.',
  });

export type Problem = z.infer<typeof problemSchema>;
