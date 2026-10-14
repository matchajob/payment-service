import { describe, expectTypeOf, it } from 'vitest';
import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import type { STATE_KEY } from '@/lib/subscriptions/state-machine/state-key';
import type { TABLE } from '@/lib/subscriptions/state-machine/transition-table';

type Table = typeof TABLE;
type TableEvents = { [S in keyof Table]: keyof Table[S] }[keyof Table];

describe('transition table coverage', () => {
  it('accepts every lifecycle event in at least one state', () => {
    expectTypeOf<TableEvents>().toEqualTypeOf<LifecycleEvent>();
  });

  it('keeps canceled terminal (D6)', () => {
    expectTypeOf<keyof Table[typeof STATE_KEY.CANCELED]>().toEqualTypeOf<never>();
  });
});
