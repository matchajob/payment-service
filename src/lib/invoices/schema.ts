import { sql } from 'drizzle-orm';
import { check, index, unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { chargesTable } from '@/lib/charges/schema';
import { INVOICE_STATUS } from '@/lib/invoices/invoice-status';
import { NO_INVOICE_ATTEMPTS } from '@/lib/invoices/invoice-attempts';
import { invoicingConnectionsTable } from '@/lib/invoicing-connections/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { sqlLiteral } from '@/lib/sql-literal';

export const invoiceStatusEnum = createDbEnumPair('invoiceStatus', INVOICE_STATUS);
export const invoiceStatusPgEnum = invoiceStatusEnum.dz;

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };

export const invoicesEntity = defineEntity(
  'invoices',
  {
    invoiceId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'InvoiceId')),
    chargeId: (f) =>
      entityFromDzd(dzdThemeUuid.requiredRef(f, { ref: () => chargesTable.chargeId, actions: restrict }, 'ChargeId')),
    invoicingConnectionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => invoicingConnectionsTable.invoicingConnectionId, actions: restrict },
          'InvoicingConnectionId',
        ),
      ),
    status: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, invoiceStatusEnum)),
    attempts: (f) => entityFromDzd(makeDzdInteger(f, { minSize: NO_INVOICE_ATTEMPTS })),
    nextAttemptAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    lastError: (f) => entityFromDzd(dzdThemeStr.nonEmpty.errorMessage(f), DZD_NULLABLE),
    invoiceRef: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f), DZD_NULLABLE),
    documentUrl: (f) => entityFromDzd(dzdThemeStr.nonEmpty.address(f), DZD_NULLABLE),
    issuedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [
      unique('invoices_one_per_charge').on(t.chargeId),
      check(
        'invoices_issued_has_ref',
        sql`(${t.status} = ${sqlLiteral(INVOICE_STATUS.ISSUED)}) = (${t.invoiceRef} is not null and ${t.issuedAt} is not null)`,
      ),
      check(
        'invoices_dead_has_last_error',
        sql`${t.status} <> ${sqlLiteral(INVOICE_STATUS.DEAD)} or ${t.lastError} is not null`,
      ),
      index('invoices_due')
        .on(t.nextAttemptAt)
        .where(sql`${t.status} = ${sqlLiteral(INVOICE_STATUS.PENDING)}`),
    ],
  },
);

export const invoicesTable = invoicesEntity.table;

export type Invoice = typeof invoicesTable.$inferSelect;
