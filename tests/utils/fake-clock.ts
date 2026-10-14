import type { Clock } from '@/lib/clock';

export type FakeClock = Clock & { set: (at: Date) => void; advance: (ms: number) => void };

export const fakeClock = (start: Date): FakeClock => {
  const state = { at: start };
  return {
    now: () => new Date(state.at.getTime()),
    set: (at) => {
      state.at = at;
    },
    advance: (ms) => {
      state.at = new Date(state.at.getTime() + ms);
    },
  };
};
