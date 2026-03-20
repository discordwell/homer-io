import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com', 'outlook.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'mail.com', 'zoho.com', 'fastmail.com',
  'hey.com', 'tutanota.com',
]);

export function extractDomain(email: string): string {
  return email.split('@')[1].toLowerCase();
}

export function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain.toLowerCase());
}

export async function findTenantByDomain(domain: string) {
  if (isGenericDomain(domain)) return null;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, autoJoinEnabled: tenants.autoJoinEnabled })
    .from(tenants)
    .where(and(eq(tenants.orgDomain, domain), eq(tenants.autoJoinEnabled, true)))
    .limit(1);

  return tenant || null;
}
