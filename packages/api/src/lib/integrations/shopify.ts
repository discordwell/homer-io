import type { EcommerceConnector, ExternalOrder } from './connector.js';
import { logger } from '../logger.js';

/**
 * Shopify REST API connector.
 * Uses Private App credentials (apiKey + password) or a single access_token.
 */
export class ShopifyConnector implements EcommerceConnector {
  platform = 'shopify';

  private getBaseUrl(storeUrl: string, _credentials: Record<string, string>): string {
    // Normalize: strip protocol and trailing slash. Never embed credentials in URL —
    // they would leak through APM traces, error stacks, proxy logs, browser history,
    // etc. Auth is carried in headers (see getHeaders).
    const host = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}/admin/api/2024-01`;
  }

  private getHeaders(credentials: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (credentials.accessToken) {
      headers['X-Shopify-Access-Token'] = credentials.accessToken;
    } else if (credentials.apiKey && credentials.password) {
      // Private-app basic auth — apiKey:password base64-encoded in the Authorization header.
      const basic = Buffer.from(`${credentials.apiKey}:${credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }
    return headers;
  }

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const baseUrl = this.getBaseUrl(storeUrl, credentials);
      const res = await fetch(`${baseUrl}/shop.json`, {
        headers: this.getHeaders(credentials),
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
    const baseUrl = this.getBaseUrl(storeUrl, credentials);
    const headers = this.getHeaders(credentials);
    const webhookIds: string[] = [];

    const topics = ['orders/create', 'orders/updated', 'orders/cancelled'];

    for (const topic of topics) {
      try {
        const res = await fetch(`${baseUrl}/webhooks.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            webhook: {
              topic,
              address: callbackUrl,
              format: 'json',
            },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const data = await res.json() as { webhook: { id: number } };
          webhookIds.push(String(data.webhook.id));
        } else {
          logger.warn({ topic, status: res.status }, '[shopify] Failed to register webhook');
        }
      } catch (err) {
        logger.warn({ err, topic }, '[shopify] Error registering webhook');
      }
    }

    return webhookIds;
  }

  async fetchOrders(
    storeUrl: string,
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ExternalOrder[]> {
    const baseUrl = this.getBaseUrl(storeUrl, credentials);
    const headers = this.getHeaders(credentials);
    const params = new URLSearchParams({
      status: 'any',
      limit: '250',
    });
    if (since) {
      params.set('created_at_min', since.toISOString());
    }

    const allOrders: ExternalOrder[] = [];
    let url: string | null = `${baseUrl}/orders.json?${params.toString()}`;

    while (url) {
      const res: Response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as { orders: ShopifyOrder[] };
      for (const order of data.orders) {
        allOrders.push(this.mapShopifyOrder(order));
      }

      // Pagination via Link header
      const linkHeader: string | null = res.headers.get('link');
      url = null;
      if (linkHeader) {
        const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          url = nextMatch[1];
        }
      }
    }

    return allOrders;
  }

  private mapShopifyOrder(order: ShopifyOrder): ExternalOrder {
    const addr = order.shipping_address || order.billing_address || {};
    return {
      externalId: String(order.id),
      orderNumber: order.name || `#${order.order_number}`,
      customerName: [addr.first_name, addr.last_name].filter(Boolean).join(' ') || order.email || 'Unknown',
      customerEmail: order.email || null,
      customerPhone: order.phone || addr.phone || null,
      shippingAddress: {
        street: [addr.address1, addr.address2].filter(Boolean).join(', '),
        city: addr.city || '',
        state: addr.province || addr.province_code || '',
        zip: addr.zip || '',
        country: addr.country_code || addr.country || 'US',
        lat: addr.latitude ? Number(addr.latitude) : undefined,
        lng: addr.longitude ? Number(addr.longitude) : undefined,
      },
      lineItems: (order.line_items || []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        weight: item.grams ? item.grams / 1000 : undefined,
        price: item.price ? Number(item.price) : undefined,
      })),
      totalWeight: order.total_weight ? order.total_weight / 1000 : null,
      notes: order.note || null,
      createdAt: order.created_at,
      rawData: order as unknown as Record<string, unknown>,
    };
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const totalItems = externalOrder.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    return {
      tenantId,
      externalId: `shopify_${externalOrder.externalId}`,
      recipientName: externalOrder.customerName,
      recipientPhone: externalOrder.customerPhone,
      recipientEmail: externalOrder.customerEmail,
      deliveryAddress: {
        street: externalOrder.shippingAddress.street,
        city: externalOrder.shippingAddress.city,
        state: externalOrder.shippingAddress.state,
        zip: externalOrder.shippingAddress.zip,
        country: externalOrder.shippingAddress.country,
        ...(externalOrder.shippingAddress.lat && externalOrder.shippingAddress.lng
          ? { coords: { lat: externalOrder.shippingAddress.lat, lng: externalOrder.shippingAddress.lng } }
          : {}),
      },
      packageCount: Math.max(1, Math.ceil(totalItems / 5)),
      weight: externalOrder.totalWeight ? String(externalOrder.totalWeight) : null,
      notes: externalOrder.notes
        ? `Shopify ${externalOrder.orderNumber}: ${externalOrder.notes}`
        : `Shopify ${externalOrder.orderNumber}`,
    };
  }
}

// Shopify API types (subset)
interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

interface ShopifyLineItem {
  name: string;
  quantity: number;
  grams?: number;
  price?: string;
}

interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  email?: string;
  phone?: string;
  note?: string;
  total_weight?: number;
  created_at: string;
  shipping_address?: ShopifyAddress;
  billing_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
}
