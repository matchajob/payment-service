import type { Charge } from '@/lib/charges/schema';
import type { Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import type { ChargeResult } from '@/lib/payments/provider';
import type { Plan } from '@/lib/plans/schema';
import type { TransitionChanges } from '@/lib/subscriptions/apply-transition';
import type { Subscription } from '@/lib/subscriptions/schema';
import type { LifecycleEvent } from '@/lib/subscriptions/state-machine/lifecycle-events';
import type { Tenant } from '@/lib/tenants/schema';

export type DueCharge = Pick<Subscription, 'subscriptionId' | 'providerConnectionId'>;
export type CycleParties = { tenant: Tenant; customer: Customer; plan: Plan; dunningScheduleDays: readonly number[] };
export type CycleSettlement = {
  subscription: Subscription;
  charge: Charge;
  result: ChargeResult;
  parties: CycleParties;
  now: Date;
};
export type CycleDecision = { event: LifecycleEvent; changes: TransitionChanges };
export type CycleDecide = (settlement: CycleSettlement) => CycleDecision;

export type ChargeCycle = {
  dueEvent: LifecycleEvent;
  findDue: (db: Database, now: Date, limit: number) => Promise<DueCharge[]>;
  isDue: (subscription: Subscription, now: Date) => boolean;
  attemptOf: (subscription: Subscription) => number;
  canceledOnDue?: (now: Date) => TransitionChanges;
  decide: CycleDecide;
};
