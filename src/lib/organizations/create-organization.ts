import type { Database } from '@/lib/db';
import { organizationsTable, type Organization } from '@/lib/organizations/schema';

export type CreateOrganizationInput = { name: string };

export const createOrganization = async (db: Database, input: CreateOrganizationInput): Promise<Organization> => {
  const [organization] = await db.insert(organizationsTable).values(input).returning();
  if (organization === undefined) throw new Error('organization insert returned no row');
  return organization;
};
