import type { Sleep } from '@sdk/client-options';

export const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
