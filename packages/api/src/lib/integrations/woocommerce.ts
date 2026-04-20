import type { EcommerceConnector, ExternalOrder } from './connector.js';
import { logger } from '../logger.js';

/**
 * WooCommerce REST API v3 connector.
 * Uses consumer key/secret for authentication via query parameters.
 */
export class WooCommerceConnector implements EcommerceConnector {
  platform = 'woocommerce';

  private getBaseUrl(storeUrl: string): string {
    const normalized = storeUrl.replace(/\/$/, '');
    return `${normalized}/wp-json/wc/v3`;
  }

  private authParams(credentials: Record<string, string>): URLSearchParams {
    return new URLSearchParams({
      consumer_key: credentials.consumerKey,
      consumer_secret: credentials.consumerSecret,
    });
  }

  private buildUrl(baseUrl: string, path: string, credentials: Record<string, string>, extra?: Record<string, string>): string {
    const params = this.authParams(credentials);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        params.set(key, value);
      }
    }
    return `${baseUrl}${path}?${params.toString()}`;
  }

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const baseUrl = this.getBaseUrl(storeUrl);
      const url = this.buildUrl(baseUrl, '/system_status', credentials);
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async registerWebhooks(
    storeUrl: string,
    credentials: Record<string, string>,
    callbackUrl: string,
  ): Promise<string[]> {
    const baseUrl = this.getBaseUrl(storeUrl);
    const webhookIds: string[] = [];

    const topics = ['order.created', 'order.updated'];

    for (const topic of topics) {
      try {
        const url = this.buildUrl(baseUrl, '/webhooks', credentials);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `HOMER ${topic}`,
            topic,
            delivery_url: callbackUrl,
            status: 'active',
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const data = await res.json() as { id: number };
          webhookIds.push(String(data.id));
        } else {
          logger.warn({ topic, status: res.status }, '[woocommerce] Failed to register webhook');
        }
      } catch (err) {
        logger.warn({ err, topic }, '[woocommerce] Error registering webhook');
      }
    }

    return webhookIds;
  }

  async fetchOrders(
    storeUrl: string,
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ExternalOrder[]> {
    const baseUrl = this.getBaseUrl(storeUrl);
    const allOrders: ExternalOrder[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const extra: Record<string, string> = {
        per_page: String(perPage),
        page: String(page),
        orderby: 'date',
        order: 'asc',
      };
      if (since) {
        extra.after = since.toISOString();
      }

      const url = this.buildUrl(baseUrl, '/orders', credentials, extra);
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new Error(`WooCommerce API error: ${res.status} ${res.statusText}`);
      }

      const orders = await res.json() as WooOrder[];
      for (const order of orders) {
        allOrders.push(this.mapWooOrder(order));
      }

      // Check if there are more pages
      const totalPages = Number(res.headers.get('x-wp-totalpages') || '1');
      if (page >= totalPages || orders.length < perPage) break;
      page++;
    }

    return allOrders;
  }

  private mapWooOrder(order: WooOrder): ExternalOrder {
    const shipping = order.shipping || {};
    const billing = order.billing || {};
    return {
      externalId: String(order.id),
      orderNumber: `#${order.number || order.id}`,
      customerName: [shipping.first_name || billing.first_name, shipping.last_name || billing.last_name]
        .filter(Boolean).join(' ') || 'Unknown',
      customerEmail: billing.email || null,
      customerPhone: billing.phone || shipping.phone || null,
      shippingAddress: {
        street: [shipping.address_1, shipping.address_2].filter(Boolean).join(', ')
          || [billing.address_1, billing.address_2].filter(Boolean).join(', '),
        city: shipping.city || billing.city || '',
        state: shipping.state || billing.state || '',
        zip: shipping.postcode || billing.postcode || '',
        country: shipping.country || billing.country || 'US',
      },
      lineItems: (order.line_items || []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        weight: undefined,
        price: item.total ? Number(item.total) : undefined,
      })),
      totalWeight: null, // WooCommerce doesn't provide total weight in order response
      notes: order.customer_note || null,
      createdAt: order.date_created,
      rawData: order as unknown as Record<string, unknown>,
    };
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const totalItems = externalOrder.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    return {
      tenantId,
      externalId: `woo_${externalOrder.externalId}`,
      recipientName: externalOrder.customerName,
      recipientPhone: externalOrder.customerPhone,
      recipientEmail: externalOrder.customerEmail,
      deliveryAddress: {
        street: externalOrder.shippingAddress.street,
        city: externalOrder.shippingAddress.city,
        state: externalOrder.shippingAddress.state,
        zip: externalOrder.shippingAddress.zip,
        country: externalOrder.shippingAddress.country,
      },
      packageCount: Math.max(1, Math.ceil(totalItems / 5)),
      weight: externalOrder.totalWeight ? String(externalOrder.totalWeight) : null,
      notes: externalOrder.notes
        ? `WooCommerce ${externalOrder.orderNumber}: ${externalOrder.notes}`
        : `WooCommerce ${externalOrder.orderNumber}`,
    };
  }
}

// WooCommerce API types (subset)
interface WooAddress {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

interface WooLineItem {
  name: string;
  quantity: number;
  total?: string;
}

interface WooOrder {
  id: number;
  number?: string;
  status: string;
  date_created: string;
  customer_note?: string;
  billing?: WooAddress;
  shipping?: WooAddress;
  line_items: WooLineItem[];
}
