import { PLAN_FLAG, type PlanFlag } from '@/cli/plan-flag';
import { zPlanCreate } from '@/lib/plans/schema';

const STRING_OPTION = { type: 'string' } as const;

export const planArgOptions = {
  [PLAN_FLAG.PLAN_NAME]: STRING_OPTION,
  [PLAN_FLAG.AMOUNT_MINOR]: STRING_OPTION,
  [PLAN_FLAG.CURRENCY]: STRING_OPTION,
  [PLAN_FLAG.INTERVAL]: STRING_OPTION,
};

export const planArgsSchema = zPlanCreate.pick({ name: true, amountMinor: true, currency: true, interval: true });

export const planArgsOf = (values: Partial<Record<PlanFlag, string>>) => ({
  name: values[PLAN_FLAG.PLAN_NAME],
  amountMinor: Number(values[PLAN_FLAG.AMOUNT_MINOR]),
  currency: values[PLAN_FLAG.CURRENCY],
  interval: values[PLAN_FLAG.INTERVAL],
});
