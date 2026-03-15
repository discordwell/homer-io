import { sql } from 'drizzle-orm';
import { db } from './index.js';

/**
 * Tables that have a tenant_id column and should be protected by RLS.
 */
const TENANT_SCOPED_TABLES = [
  'users',
  'vehicles',
  'drivers',
  'orders',
  'routes',
  'api_keys',
  'notifications',
  'org_settings',
  'activity_log',
  'location_history',
  'proof_of_delivery',
  'notification_templates',
  'customer_notifications_log',
  'webhook_endpoints',
  'webhook_deliveries',
  'subscriptions',
  'invoices',
  'usage_records',
  'integration_connections',
] as const;

/**
 * SQL to set up RLS on all tenant-scoped tables.
 * Run this in a migration or manually against the database.
 *
 * Creates a `current_tenant_id()` function that reads from
 * the session variable `app.tenant_id`, then enables RLS and
 * creates SELECT/INSERT/UPDATE/DELETE policies for each table.
 */
export const rlsSetupSQL = `
-- Function to read the current tenant from session
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT current_setting('app.tenant_id')::uuid;
$$ LANGUAGE sql STABLE;

${TENANT_SCOPED_TABLES.map(
  (table) => `
-- RLS for ${table}
ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";
CREATE POLICY "${table}_tenant_isolation" ON "${table}"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
`
).join('')}
`;

/**
 * Execute a function within a database transaction that has
 * the `app.tenant_id` session variable set, enabling RLS-based
 * tenant isolation.
 *
 * Uses SET LOCAL so the setting is scoped to the transaction.
 */
export async function withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId}`);
    return fn();
  });
}
