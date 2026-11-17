import type { TimeUp } from '@/lib/cron/time-up';

export const NEVER_TIME_UP: TimeUp = () => false;
export const ALWAYS_TIME_UP: TimeUp = () => true;
