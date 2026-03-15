import { Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../lib/db.js';

// Minimal schema definitions for worker (mirrors API schema)
import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, pgEnum, uniqueIndex, numeric, text } from 'drizzle-orm/pg-core';

const integrationPlatformEnum = pgEnum('integration_platform', ['shopify', 'woocommerce']);
const syncStatusEnum = pgEnum('sync_status', ['idle', 'syncing', 'error']);
const integrationSyncStatusEnum = pgEnum('integration_sync_status', ['pending', 'synced', 'failed', 'skipped']);

const integrationConnections = pgTable('integration_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  platform: integrationPlatformEnum('platform').notNull(),
  storeUrl: varchar('store_url', { length: 500 }).notNull(),
  credentials: jsonb('credentials').notNull(),
  webhookIds: jsonb('webhook_ids').default([]).notNull(),
  autoImport: boolean('auto_import').default(true).notNull(),
  syncStatus: syncStatusEnum('sync_status').default('idle').notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncError: varchar('last_sync_error', { length: 1000 }),
  orderCount: integer('order_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

const integrationOrders = pgTable('integration_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id').notNull(),
  orderId: uuid('order_id'),
  externalOrderId: varchar('external_order_id', { length: 255 }).notNull(),
  platform: varchar('platform', { length: 50 }).notNull(),
  rawData: jsonb('raw_data').default({}).notNull(),
  syncStatus: integrationSyncStatusEnum('sync_status').default('pending').notNull(),
  syncError: varchar('sync_error', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  externalId: varchar('external_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('received').notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  deliveryAddress: jsonb('delivery_address').notNull(),
  deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
  deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),
  packageCount: integer('package_count').default(1).notNull(),
  weight: numeric('weight', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Crypto helpers (duplicated from API to avoid cross-package import) ──────

function deriveKey(key: string): Buffer {
  return createHash('sha256').update(key).digest();
}

function decrypt(encrypted: string, key?: string): string {
  const encKey = key || process.env.INTEGRATION_ENCRYPTION_KEY || 'homer-dev-encryption-key-do-not-use-in-prod';
  const { createDecipheriv } = require('crypto');
  const derivedKey = deriveKey(encKey);
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── Connector logic (minimal duplication for worker context) ────────────────

interface ExternalOrder {
  externalId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: {
    street: string; city: string; state: string; zip: string; country: string;
    lat?: number; lng?: number;
  };
  lineItems: Array<{ name: string; quantity: number; weight?: number }>;
  totalWeight: number | null;
  notes: string | null;
  createdAt: string;
  rawData: Record<string, unknown>;
}

async function fetchShopifyOrders(storeUrl: string, credentials: Record<string, string>, since?: Date): Promise<ExternalOrder[]> {
  const host = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseUrl = credentials.accessToken
    ? `https://${host}/admin/api/2024-01`
    : `https://${credentials.apiKey}:${credentials.password}@${host}/admin/api/2024-01`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (credentials.accessToken) headers['X-Shopify-Access-Token'] = credentials.accessToken;

  const params = new URLSearchParams({ status: 'any', limit: '250' });
  if (since) params.set('created_at_min', since.toISOString());

  const allOrders: ExternalOrder[] = [];
  let url: string | null = `${baseUrl}/orders.json?${params.toString()}`;

  while (url) {
    const res: Response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
    const data = await res.json() as { orders: any[] };
    for (const o of data.orders) {
      const addr = o.shipping_address || o.billing_address || {};
      allOrders.push({
        externalId: String(o.id),
        orderNumber: o.name || `#${o.order_number}`,
        customerName: [addr.first_name, addr.last_name].filter(Boolean).join(' ') || o.email || 'Unknown',
        customerEmail: o.email || null,
        customerPhone: o.phone || addr.phone || null,
        shippingAddress: {
          street: [addr.address1, addr.address2].filter(Boolean).join(', '),
          city: addr.city || '', state: addr.province || '', zip: addr.zip || '',
          country: addr.country_code || 'US',
          lat: addr.latitude ? Number(addr.latitude) : undefined,
          lng: addr.longitude ? Number(addr.longitude) : undefined,
        },
        lineItems: (o.line_items || []).map((i: any) => ({
          name: i.name, quantity: i.quantity, weight: i.grams ? i.grams / 1000 : undefined,
        })),
        totalWeight: o.total_weight ? o.total_weight / 1000 : null,
        notes: o.note || null,
        createdAt: o.created_at,
        rawData: o,
      });
    }
    const linkHeader: string | null = res.headers.get('link');
    url = null;
    if (linkHeader) {
      const next: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (next) url = next[1];
    }
  }

  return allOrders;
}

async function fetchWooOrders(storeUrl: string, credentials: Record<string, string>, since?: Date): Promise<ExternalOrder[]> {
  const baseUrl = `${storeUrl.replace(/\/$/, '')}/wp-json/wc/v3`;
  const allOrders: ExternalOrder[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      consumer_key: credentials.consumerKey,
      consumer_secret: credentials.consumerSecret,
      per_page: '100', page: String(page), orderby: 'date', order: 'asc',
    });
    if (since) params.set('after', since.toISOString());

    const res = await fetch(`${baseUrl}/orders?${params.toString()}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`WooCommerce API error: ${res.status}`);
    const wooOrders = await res.json() as any[];

    for (const o of wooOrders) {
      const s = o.shipping || {}; const b = o.billing || {};
      allOrders.push({
        externalId: String(o.id),
        orderNumber: `#${o.number || o.id}`,
        customerName: [s.first_name || b.first_name, s.last_name || b.last_name].filter(Boolean).join(' ') || 'Unknown',
        customerEmail: b.email || null,
        customerPhone: b.phone || s.phone || null,
        shippingAddress: {
          street: [s.address_1, s.address_2].filter(Boolean).join(', ') || [b.address_1, b.address_2].filter(Boolean).join(', '),
          city: s.city || b.city || '', state: s.state || b.state || '',
          zip: s.postcode || b.postcode || '', country: s.country || b.country || 'US',
        },
        lineItems: (o.line_items || []).map((i: any) => ({ name: i.name, quantity: i.quantity })),
        totalWeight: null, notes: o.customer_note || null,
        createdAt: o.date_created, rawData: o,
      });
    }

    const totalPages = Number(res.headers.get('x-wp-totalpages') || '1');
    if (page >= totalPages || wooOrders.length < 100) break;
    page++;
  }

  return allOrders;
}

function mapToHomer(platform: string, ext: ExternalOrder, tenantId: string) {
  const prefix = platform === 'shopify' ? 'shopify' : 'woo';
  const totalItems = ext.lineItems.reduce((s, i) => s + i.quantity, 0);
  return {
    tenantId,
    externalId: `${prefix}_${ext.externalId}`,
    recipientName: ext.customerName,
    recipientPhone: ext.customerPhone,
    recipientEmail: ext.customerEmail,
    deliveryAddress: {
      street: ext.shippingAddress.street, city: ext.shippingAddress.city,
      state: ext.shippingAddress.state, zip: ext.shippingAddress.zip,
      country: ext.shippingAddress.country,
      ...(ext.shippingAddress.lat && ext.shippingAddress.lng
        ? { coords: { lat: ext.shippingAddress.lat, lng: ext.shippingAddress.lng } } : {}),
    },
    packageCount: Math.max(1, Math.ceil(totalItems / 5)),
    weight: ext.totalWeight ? String(ext.totalWeight) : null,
    notes: ext.notes
      ? `${platform === 'shopify' ? 'Shopify' : 'WooCommerce'} ${ext.orderNumber}: ${ext.notes}`
      : `${platform === 'shopify' ? 'Shopify' : 'WooCommerce'} ${ext.orderNumber}`,
  };
}

// ─── Job Processor ───────────────────────────────────────────────────────────

export interface IntegrationSyncJobData {
  connectionId: string;
  tenantId: string;
  type: 'initial' | 'periodic';
}

export async function processIntegrationSync(job: Job<IntegrationSyncJobData>) {
  const { connectionId, tenantId, type } = job.data;

  console.log(`[integration-sync] Starting ${type} sync for connection ${connectionId}`);

  // Fetch the connection
  const [conn] = await db.select().from(integrationConnections)
    .where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) {
    console.error(`[integration-sync] Connection ${connectionId} not found`);
    return;
  }

  // Mark as syncing
  await db.update(integrationConnections)
    .set({ syncStatus: 'syncing', updatedAt: new Date() })
    .where(eq(integrationConnections.id, connectionId));

  try {
    const credentials = JSON.parse(decrypt(conn.credentials as string));

    // For initial sync, go back 30 days; for periodic, use lastSyncAt
    const since = type === 'initial'
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : (conn.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000));

    // Fetch orders from platform
    let externalOrders: ExternalOrder[];
    if (conn.platform === 'shopify') {
      externalOrders = await fetchShopifyOrders(conn.storeUrl, credentials, since);
    } else {
      externalOrders = await fetchWooOrders(conn.storeUrl, credentials, since);
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const ext of externalOrders) {
      try {
        // Deduplication check
        const [existing] = await db.select({ id: integrationOrders.id })
          .from(integrationOrders)
          .where(and(
            eq(integrationOrders.connectionId, connectionId),
            eq(integrationOrders.externalOrderId, ext.externalId),
          ))
          .limit(1);

        if (existing) {
          skipped++;
          continue;
        }

        const mapped = mapToHomer(conn.platform, ext, tenantId);

        const [newOrder] = await db.insert(orders).values({
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
        }).returning();

        await db.insert(integrationOrders).values({
          connectionId,
          orderId: newOrder.id,
          externalOrderId: ext.externalId,
          platform: conn.platform,
          rawData: ext.rawData,
          syncStatus: 'synced',
        });

        imported++;
      } catch (err) {
        try {
          await db.insert(integrationOrders).values({
            connectionId,
            externalOrderId: ext.externalId,
            platform: conn.platform,
            rawData: ext.rawData,
            syncStatus: 'failed',
            syncError: err instanceof Error ? err.message.slice(0, 1000) : 'Unknown error',
          }).onConflictDoNothing();
        } catch {
          // Ignore dedup conflicts
        }
        failed++;
      }
    }

    // Update connection
    await db.update(integrationConnections).set({
      syncStatus: 'idle',
      lastSyncAt: new Date(),
      lastSyncError: null,
      orderCount: sql`${integrationConnections.orderCount} + ${imported}`,
      updatedAt: new Date(),
    }).where(eq(integrationConnections.id, connectionId));

    console.log(`[integration-sync] Completed ${type} sync for ${connectionId}: ${imported} imported, ${skipped} skipped, ${failed} failed`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    console.error(`[integration-sync] Sync failed for ${connectionId}:`, errorMsg);

    await db.update(integrationConnections).set({
      syncStatus: 'error',
      lastSyncError: errorMsg.slice(0, 1000),
      updatedAt: new Date(),
    }).where(eq(integrationConnections.id, connectionId));

    throw err; // Let BullMQ handle retries
  }
}
