import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { CREATE_CUSTOMER_OUTCOME, createCustomer } from '@/lib/customers/create-customer';
import { findCustomer } from '@/lib/customers/find-customer';
import { zCustomerCreate, zCustomerRead, type Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import type { CustomerResponse } from '@/contract/customer-response';

const createBody = zCustomerCreate.pick({ externalRef: true });
const customerIdParam = zCustomerRead.shape.customerId;

const toResponse = ({ customerId, externalRef }: Customer): CustomerResponse => ({
  data: { customerId, externalRef },
});

export const customersRoutes = (db: Database) =>
  new Hono<AppEnv>()
    .post('/', async (c) => {
      const body = createBody.safeParse(await c.req.json().catch(() => undefined));
      if (!body.success) return problemResponse(c, HTTP_STATUS.BAD_REQUEST, body.error.message);
      const result = await createCustomer(db, c.get('tenant').tenantId, body.data.externalRef);
      if (result.outcome === CREATE_CUSTOMER_OUTCOME.DUPLICATE) {
        return problemResponse(c, HTTP_STATUS.CONFLICT, `customer ${body.data.externalRef} already exists`);
      }
      return c.json(toResponse(result.customer), HTTP_STATUS.CREATED);
    })
    .get('/:customerId', async (c) => {
      const customerId = customerIdParam.safeParse(c.req.param('customerId'));
      if (!customerId.success) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      const customer = await findCustomer(db, c.get('tenant').tenantId, customerId.data);
      if (customer === undefined) return problemResponse(c, HTTP_STATUS.NOT_FOUND);
      return c.json(toResponse(customer));
    });