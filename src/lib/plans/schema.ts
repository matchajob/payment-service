import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { dzdThemeInt } from '@matcha/infra/dzd/dzd-integer';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { currencyEnum } from '@/lib/money/schema';
import { BILLING_INTERVAL } from '@/lib/subscriptions/billing-interval';
import { tenantsTable } from '@/lib/tenants/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';

export const billingIntervalEnum = createDbEnumPair('billingInterval', BILLING_INTERVAL);

export const billingIntervalPgEnum = billingIntervalEnum.dz;

export const plansEntity = defineEntity('plans', {
  planId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'PlanId')),
  tenantId: (f) =>
        entityFromDzd(
        dzdThemeUuid.requiredRef(
            f,
            { ref: () => tenantsTable.tenantId, actions: { onDelete: REFERENTIAL_ACTION.RESTRICT } },
            'TenantId',
        ),
    ),
  name: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f)),
  amountMinor: (f) => entityFromDzd(dzdThemeInt.positive(f)),
  currency: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, currencyEnum)),
  interval: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, billingIntervalEnum)),
  createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
});

export const plansTable = plansEntity.table;

export type Plan = typeof plansTable.$inferSelect;
export type NewPlan = typeof plansTable.$inferInsert;