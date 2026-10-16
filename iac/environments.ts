export const ENVIRONMENTS = ['staging', 'production'] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

export const PRODUCTION: Environment = 'production';
