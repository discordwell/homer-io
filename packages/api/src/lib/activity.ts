import { db } from './db/index.js';
import { activityLog } from './db/schema/activity-log.js';

export async function logActivity(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityLog).values({
    tenantId: params.tenantId,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}
