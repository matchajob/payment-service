import type { Database } from '@/lib/db';
import { organizationsTable, type Organization } from '@/lib/organizations/schema';

const NO_ROW = 'organization insert returned no row';

export type CreateOrganizationInput = { name: string };

export const createOrganization = async (db: Database, input: CreateOrganizationInput): Promise<Organization> => {
  const [organization] = await db.insert(organizationsTable).values(input).returning();
  if (organization === undefined) throw new Error(NO_ROW);
  return organization;
};
