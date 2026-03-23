import { eq, and, desc, sql } from 'drizzle-orm';
import { createHmac, randomBytes } from 'crypto';
import { db } from '../../lib/db/index.js';
import { integrationConnections } from '../../lib/db/schema/integration-connections.js';
import { integrationOrders } from '../../lib/db/schema/integration-orders.js';
import { orders } from '../../lib/db/schema/orders.js';
import type { IntegrationPlatform } from '@homer-io/shared';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';
import { encrypt, decrypt, getConnector, getAvailablePlatforms as getPlatforms } from '../../lib/integrations/index.js';
import { config } from '../../config.js';

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatConnection(conn: typeof integrationConnections.$inferSelect) {
  return {
    id: conn.id,
    platform: conn.platform,
    storeUrl: conn.storeUrl,
    autoImport: conn.autoImport,
    syncStatus: conn.syncStatus,
    lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
    lastSyncError: conn.lastSyncError,
    orderCount: conn.orderCount,
    createdAt: conn.createdAt.toISOString(),
  };
}

function formatIntegrationOrder(io: typeof integrationOrders.$inferSelect) {
  return {
    id: io.id,
    connectionId: io.connectionId,
    orderId: io.orderId,
    externalOrderId: io.externalOrderId,
    platform: io.platform,
    syncStatus: io.syncStatus,
    syncError: io.syncError,
    createdAt: io.createdAt.toISOString(),
  };
}

// ─── Connection CRUD ─────────────────────────────────────────────────────────

export async function listConnections(tenantId: string) {
  const conns = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.tenantId, tenantId))
    .orderBy(desc(integrationConnections.createdAt));

  return conns.map(formatConnection);
}

export async function getConnection(tenantId: string, id: string) {
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) {
    throw new HttpError(404, 'Integration connection not found');
  }

  return formatConnection(conn);
}

export async function createConnection(
  tenantId: string,
  userId: string,
  input: { platform: IntegrationPlatform; storeUrl: string; credentials: Record<string, string>; autoImport: boolean },
) {
  const connector = getConnector(input.platform);

  // Validate credentials before saving
  const valid = await connector.validateCredentials(input.credentials, input.storeUrl);
  if (!valid) {
    throw new HttpError(400, 'Invalid credentials — could not connect to the store');
  }

  // Encrypt credentials
  const encryptedCreds = encrypt(JSON.stringify(input.credentials));

  // Generate per-connection webhook secret for inbound verification
  const webhookSecret = randomBytes(32).toString('hex');

  // Insert connection first so we have the ID for the webhook callback URL
  const [created] = await db
    .insert(integrationConnections)
    .values({
      tenantId,
      platform: input.platform,
      storeUrl: input.storeUrl,
      credentials: encryptedCreds,
      webhookIds: [],
      webhookSecret,
      autoImport: input.autoImport,
    })
    .returning();

  // Register webhooks — use API base URL (not frontend CORS origin)
  const apiBaseUrl = config.nodeEnv === 'production'
    ? 'https://api.homer.io'
    : config.cors.origin[0];
  const webhookCallbackUrl = `${apiBaseUrl}/api/integrations/webhook/${input.platform}/${created.id}`;
  let webhookIds: string[] = [];
  try {
    webhookIds = await connector.registerWebhooks(input.storeUrl, input.credentials, webhookCallbackUrl);
    await db.update(integrationConnections)
      .set({ webhookIds })
      .where(eq(integrationConnections.id, created.id));
  } catch (err) {
    console.warn(`[integrations] Failed to register webhooks for ${input.platform}:`, err);
  }

  await logActivity({
    tenantId,
    userId,
    action: 'create',
    entityType: 'integration_connection',
    entityId: created.id,
    metadata: { platform: input.platform, storeUrl: input.storeUrl },
  });

  return formatConnection(created);
}

export async function updateConnection(
  tenantId: string,
  id: string,
  userId: string,
  input: { credentials?: Record<string, string>; autoImport?: boolean },
) {
  const [existing] = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, 'Integration connection not found');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.credentials !== undefined) {
    // Validate new credentials
    const connector = getConnector(existing.platform);
    const valid = await connector.validateCredentials(input.credentials, existing.storeUrl);
    if (!valid) {
      throw new HttpError(400, 'Invalid credentials — could not connect to the store');
    }
    updateData.credentials = encrypt(JSON.stringify(input.credentials));
  }

  if (input.autoImport !== undefined) {
    updateData.autoImport = input.autoImport;
  }

  const [updated] = await db
    .update(integrationConnections)
    .set(updateData)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)))
    .returning();

  await logActivity({
    tenantId,
    userId,
    action: 'update',
    entityType: 'integration_connection',
    entityId: id,
    metadata: { changes: Object.keys(input) },
  });

  return formatConnection(updated);
}

export async function deleteConnection(tenantId: string, id: string, userId: string) {
  const [existing] = await db
    .select({ id: integrationConnections.id, platform: integrationConnections.platform, storeUrl: integrationConnections.storeUrl })
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, 'Integration connection not found');
  }

  await db
    .delete(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)));

  await logActivity({
    tenantId,
    userId,
    action: 'delete',
    entityType: 'integration_connection',
    entityId: id,
    metadata: { platform: existing.platform, storeUrl: existing.storeUrl },
  });
}

// ─── Test & Sync ─────────────────────────────────────────────────────────────

export async function testConnection(tenantId: string, id: string) {
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) {
    throw new HttpError(404, 'Integration connection not found');
  }

  const connector = getConnector(conn.platform);
  const credentials = JSON.parse(decrypt(conn.credentials as string));
  const valid = await connector.validateCredentials(credentials, conn.storeUrl);

  if (!valid) {
    // Update sync status to error
    await db.update(integrationConnections)
      .set({ syncStatus: 'error', lastSyncError: 'Credential validation failed', updatedAt: new Date() })
      .where(eq(integrationConnections.id, id));
  }

  return { success: valid };
}

export async function syncOrders(tenantId: string, connectionId: string, since?: Date) {
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) {
    throw new HttpError(404, 'Integration connection not found');
  }

  // Mark as syncing
  await db.update(integrationConnections)
    .set({ syncStatus: 'syncing', updatedAt: new Date() })
    .where(eq(integrationConnections.id, connectionId));

  try {
    const connector = getConnector(conn.platform);
    const credentials = JSON.parse(decrypt(conn.credentials as string));

    // Default to last sync time or 30 days back for initial sync
    const syncSince = since || conn.lastSyncAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const externalOrders = await connector.fetchOrders(conn.storeUrl, credentials, syncSince);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // Batch-fetch existing external IDs to avoid N+1 dedup queries
    const existingIds = new Set<string>();
    if (externalOrders.length > 0) {
      const extIds = externalOrders.map(o => o.externalId);
      const existing = await db
        .select({ externalOrderId: integrationOrders.externalOrderId })
        .from(integrationOrders)
        .where(and(
          eq(integrationOrders.connectionId, connectionId),
          sql`${integrationOrders.externalOrderId} = ANY(${extIds})`,
        ));
      for (const e of existing) {
        existingIds.add(e.externalOrderId);
      }
    }

    for (const extOrder of externalOrders) {
      try {
        // Check dedup against pre-fetched set
        if (existingIds.has(extOrder.externalId)) {
          skipped++;
          continue;
        }

        // Map to HOMER format and create order
        const mapped = connector.mapOrderToHomer(extOrder, tenantId);
        const [newOrder] = await db
          .insert(orders)
          .values({
            tenantId: mapped.tenantId,
            externalId: mapped.externalId,
            recipientName: mapped.recipientName,
            recipientPhone: mapped.recipientPhone,
            recipientEmail: mapped.recipientEmail,
            deliveryAddress: mapped.deliveryAddress,
            deliveryLat: mapped.deliveryAddress.coords?.lat?.toString() ?? null,
            deliveryLng: mapped.deliveryAddress.coords?.lng?.toString() ?? null,
            packageCount: mapped.packageCount,
            weight: mapped.weight,
            notes: mapped.notes,
          })
          .returning();

        // Record the integration order mapping
        await db.insert(integrationOrders).values({
          tenantId: conn.tenantId,
          connectionId,
          orderId: newOrder.id,
          externalOrderId: extOrder.externalId,
          platform: conn.platform,
          rawData: extOrder.rawData,
          syncStatus: 'synced',
        });

        imported++;
      } catch (err) {
        // Record the failed integration order
        try {
          await db.insert(integrationOrders).values({
            tenantId: conn.tenantId,
            connectionId,
            externalOrderId: extOrder.externalId,
            platform: conn.platform,
            rawData: extOrder.rawData,
            syncStatus: 'failed',
            syncError: err instanceof Error ? err.message : 'Unknown error',
          }).onConflictDoNothing();
        } catch {
          // Ignore dedup conflicts
        }
        failed++;
      }
    }

    // Update connection status
    await db.update(integrationConnections)
      .set({
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        lastSyncError: null,
        orderCount: sql`${integrationConnections.orderCount} + ${imported}`,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId));

    return { imported, skipped, failed, total: externalOrders.length };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    await db.update(integrationConnections)
      .set({
        syncStatus: 'error',
        lastSyncError: errorMsg.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId));

    throw new HttpError(500, `Sync failed: ${errorMsg}`);
  }
}

// ─── Inbound Webhook ─────────────────────────────────────────────────────────

export async function processInboundWebhook(
  connectionId: string,
  platform: string,
  body: Record<string, unknown>,
  signature: string | null,
) {
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(and(
      eq(integrationConnections.id, connectionId),
      eq(integrationConnections.platform, platform as 'shopify' | 'woocommerce'),
    ))
    .limit(1);

  if (!conn) {
    throw new HttpError(404, 'Integration connection not found');
  }

  const credentials = JSON.parse(decrypt(conn.credentials as string));

  // Platform-specific signature verification — REQUIRED for all inbound webhooks.
  // Reject if no signature is provided (prevents unauthenticated webhook injection).
  if (platform === 'shopify') {
    // Shopify sends HMAC-SHA256 in X-Shopify-Hmac-Sha256 header
    const secret = credentials.password || credentials.apiSecret;
    if (!signature || !secret) {
      throw new HttpError(401, 'Missing webhook signature — all inbound webhooks must be signed');
    }
    const computed = createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('base64');
    if (computed !== signature) {
      throw new HttpError(401, 'Invalid webhook signature');
    }
  } else if (platform === 'woocommerce') {
    // WooCommerce sends signature in X-WC-Webhook-Signature header
    const secret = credentials.consumerSecret;
    if (!signature || !secret) {
      throw new HttpError(401, 'Missing webhook signature — all inbound webhooks must be signed');
    }
    const computed = createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('base64');
    if (computed !== signature) {
      throw new HttpError(401, 'Invalid webhook signature');
    }
  } else {
    throw new HttpError(400, `Unsupported platform: ${platform}`);
  }

  // Map the webhook body to an ExternalOrder
  const connector = getConnector(platform);
  const externalId = String(body.id || '');
  if (!externalId) {
    throw new HttpError(400, 'Missing order ID in webhook body');
  }

  // Deduplicate
  const [existingIntOrder] = await db
    .select({ id: integrationOrders.id })
    .from(integrationOrders)
    .where(and(
      eq(integrationOrders.connectionId, connectionId),
      eq(integrationOrders.externalOrderId, externalId),
    ))
    .limit(1);

  if (existingIntOrder) {
    return { status: 'skipped', reason: 'Order already imported' };
  }

  try {
    // Build an ExternalOrder directly from the webhook body — never re-fetch the full catalog.
    // Extract address from platform-specific body shapes.
    const shippingAddr = (body.shipping_address || body.shipping || {}) as Record<string, unknown>;
    const billingAddr = (body.billing_address || body.billing || {}) as Record<string, unknown>;
    const addr = shippingAddr.address1 || shippingAddr.address_1 ? shippingAddr : billingAddr;

    const externalOrder = {
      externalId,
      orderNumber: String(body.name || body.number || body.id || ''),
      customerName: [addr.first_name, addr.last_name].filter(Boolean).join(' ') || String(body.email || 'Unknown'),
      customerEmail: String(body.email || billingAddr.email || '') || null,
      customerPhone: String(body.phone || billingAddr.phone || addr.phone || '') || null,
      shippingAddress: {
        street: [addr.address1 || addr.address_1, addr.address2 || addr.address_2].filter(Boolean).join(', '),
        city: String(addr.city || ''),
        state: String(addr.province || addr.province_code || addr.state || ''),
        zip: String(addr.zip || addr.postcode || ''),
        country: String(addr.country_code || addr.country || 'US'),
        ...(addr.latitude ? { lat: Number(addr.latitude) } : {}),
        ...(addr.longitude ? { lng: Number(addr.longitude) } : {}),
      },
      lineItems: Array.isArray(body.line_items)
        ? (body.line_items as Record<string, unknown>[]).map(i => ({
            name: String(i.name || ''),
            quantity: Number(i.quantity || 1),
            weight: i.grams ? Number(i.grams) / 1000 : undefined,
          }))
        : [],
      totalWeight: body.total_weight ? Number(body.total_weight) / 1000 : null,
      notes: String(body.note || body.customer_note || '') || null,
      createdAt: String(body.created_at || body.date_created || new Date().toISOString()),
      rawData: body,
    };

    const mapped = connector.mapOrderToHomer(externalOrder, conn.tenantId);

    const [newOrder] = await db
      .insert(orders)
      .values({
        tenantId: mapped.tenantId,
        externalId: mapped.externalId,
        recipientName: mapped.recipientName,
        recipientPhone: mapped.recipientPhone,
        recipientEmail: mapped.recipientEmail,
        deliveryAddress: mapped.deliveryAddress,
        deliveryLat: mapped.deliveryAddress.coords?.lat?.toString() ?? null,
        deliveryLng: mapped.deliveryAddress.coords?.lng?.toString() ?? null,
        packageCount: mapped.packageCount,
        weight: mapped.weight,
        notes: mapped.notes,
      })
      .returning();

    await db.insert(integrationOrders).values({
      tenantId: conn.tenantId,
      connectionId,
      orderId: newOrder.id,
      externalOrderId: externalId,
      platform: conn.platform,
      rawData: body,
      syncStatus: 'synced',
    });

    // Update order count
    await db.update(integrationConnections)
      .set({
        orderCount: sql`${integrationConnections.orderCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId));

    return { status: 'imported', orderId: newOrder.id };
  } catch (err) {
    // Record the failed import attempt
    try {
      await db.insert(integrationOrders).values({
        tenantId: conn.tenantId,
        connectionId,
        externalOrderId: externalId,
        platform: conn.platform,
        rawData: body,
        syncStatus: 'failed',
        syncError: err instanceof Error ? err.message : 'Unknown error',
      }).onConflictDoNothing();
    } catch {
      // Ignore dedup conflicts
    }
    throw err;
  }
}

// ─── Integration Orders ──────────────────────────────────────────────────────

export async function listIntegrationOrders(
  tenantId: string,
  connectionId: string,
  page: number = 1,
  limit: number = 20,
) {
  // Verify connection belongs to tenant
  const [conn] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) {
    throw new HttpError(404, 'Integration connection not found');
  }

  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(integrationOrders)
      .where(eq(integrationOrders.connectionId, connectionId))
      .orderBy(desc(integrationOrders.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(integrationOrders)
      .where(eq(integrationOrders.connectionId, connectionId)),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: items.map(formatIntegrationOrder),
    pagination: { page, limit, total, totalPages },
  };
}

// ─── Platforms ────────────────────────────────────────────────────────────────

export { getPlatforms as getAvailablePlatforms };
