import { z } from 'zod';
import type { Tenant } from '@/lib/tenants/schema';

const storedSchedule = z.array(z.int().positive());

export const dunningScheduleOf = ({ dunningScheduleDays }: Pick<Tenant, 'dunningScheduleDays'>): number[] =>
  storedSchedule.parse(dunningScheduleDays);
