import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';

export const organizationsEntity = defineEntity('organizations', {
  organizationId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'OrganizationId')),
  name: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f)),
  createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
});

export const organizationsTable = organizationsEntity.table;
export const zOrganizationCreate = organizationsEntity.create;

export type Organization = typeof organizationsTable.$inferSelect;
