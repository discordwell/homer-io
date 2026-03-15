import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { dataExportRequests, orders, routes, drivers, users, activityLog, customerNotificationsLog, webhookDeliveries, tenants } from '../lib/schema.js';
import { logger } from '../lib/logger.js';

interface DataExportJobData {
  tenantId: string;
  exportId: string;
}

const log = logger.child({ worker: 'data-export' });

export async function processDataExport(job: Job<DataExportJobData>) {
  const { tenantId, exportId } = job.data;
  log.info('Processing export', { exportId, tenantId });

  try {
    // Mark as processing
    await db.update(dataExportRequests).set({ status: 'processing' })
      .where(eq(dataExportRequests.id, exportId));

    // Collect all tenant data
    const [tenantData] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const allOrders = await db.select().from(orders).where(eq(orders.tenantId, tenantId));
    const allRoutes = await db.select().from(routes).where(eq(routes.tenantId, tenantId));
    const allDrivers = await db.select().from(drivers).where(eq(drivers.tenantId, tenantId));
    const allUsers = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
      .from(users).where(eq(users.tenantId, tenantId));
    const allActivity = await db.select().from(activityLog).where(eq(activityLog.tenantId, tenantId));
    const allNotifLog = await db.select().from(customerNotificationsLog).where(eq(customerNotificationsLog.tenantId, tenantId));
    const allWebhooks = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.tenantId, tenantId));

    const exportData = {
      exportedAt: new Date().toISOString(),
      tenant: tenantData,
      users: allUsers,
      orders: allOrders,
      routes: allRoutes,
      drivers: allDrivers,
      activityLog: allActivity,
      notificationLog: allNotifLog,
      webhookDeliveries: allWebhooks,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);

    // Store as data URL (dev mode -- MinIO upload can be added later)
    const dataUrl = `data:application/json;base64,${Buffer.from(jsonStr).toString('base64')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.update(dataExportRequests).set({
      status: 'completed', fileUrl: dataUrl, expiresAt, completedAt: new Date(),
    }).where(eq(dataExportRequests.id, exportId));

    log.info('Export completed', { exportId, bytes: jsonStr.length });
    return { exportId, bytes: jsonStr.length };
  } catch (err) {
    log.error('Export failed', { exportId, error: err instanceof Error ? err.message : 'Unknown error' });
    await db.update(dataExportRequests).set({ status: 'failed' })
      .where(eq(dataExportRequests.id, exportId));
    throw err;
  }
}
