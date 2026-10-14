import pino, { type Logger } from 'pino';

export type CapturingLogger = { logger: Logger; lines: () => Record<string, unknown>[] };

export const capturingLogger = (): CapturingLogger => {
  const written: string[] = [];
  const logger = pino({}, { write: (line: string) => written.push(line) });
  return { logger, lines: () => written.map((line) => JSON.parse(line)) };
};
