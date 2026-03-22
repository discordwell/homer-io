import type { EcommerceConnector, ExternalOrder } from './connector.js';

/**
 * FTD Mercury wire service connector.
 * FTD is the largest floral wire service — florists receive incoming orders
 * from FTD.com that need to be fulfilled and delivered locally.
 * API: FTD Mercury Technology Platform
 */
export class FTDConnector implements EcommerceConnector {
  platform = 'ftd';

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/orders?limit=1`, {
        headers: this.headers(credentials),
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
    // FTD uses polling-based sync rather than webhooks for most shops
    // Webhook support varies by FTD tier
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/webhooks`, {
        method: 'POST',
        headers: this.headers(credentials),
        body: JSON.stringify({
          url: callbackUrl,
          events: ['order.created', 'order.updated'],
        }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        return [data.id];
      }
    } catch { /* polling fallback */ }
    return [];
  }

  async fetchOrders(
    storeUrl: string,
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ExternalOrder[]> {
    const params = new URLSearchParams({
      status: 'pending,confirmed',
      type: 'incoming',
      limit: '100',
    });
    if (since) params.set('created_after', since.toISOString());

    const res = await fetch(`${this.apiBase(storeUrl)}/orders?${params}`, {
      headers: this.headers(credentials),
    });

    if (!res.ok) {
      throw new Error(`FTD API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { orders: FTDOrder[] };
    return (data.orders ?? []).map(o => this.toExternal(o));
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const raw = externalOrder.rawData as unknown as FTDOrder;
    const totalPackages = externalOrder.lineItems.reduce((sum, li) => sum + li.quantity, 0);

    const itemSummary = externalOrder.lineItems
      .map(li => `${li.quantity}x ${li.name}`)
      .join(', ');

    return {
      tenantId,
      externalId: externalOrder.externalId,
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
      packageCount: totalPackages || 1,
      weight: externalOrder.totalWeight ? String(externalOrder.totalWeight) : null,
      notes: `FTD #${externalOrder.orderNumber}: ${itemSummary}`,
      // Florist-specific: sender + gift data
      senderName: raw.senderName || null,
      senderEmail: raw.senderEmail || null,
      senderPhone: raw.senderPhone || null,
      giftMessage: raw.cardMessage || null,
      isGift: true,
      requiresPhoto: true,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private apiBase(storeUrl: string): string {
    const host = storeUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    return `https://${host}/api/v1`;
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credentials.apiKey}`,
      ...(credentials.shopCode ? { 'X-FTD-Shop-Code': credentials.shopCode } : {}),
    };
  }

  private toExternal(order: FTDOrder): ExternalOrder {
    return {
      externalId: order.id || order.orderNumber,
      orderNumber: order.orderNumber || order.id,
      customerName: order.recipientName || '',
      customerEmail: order.recipientEmail || null,
      customerPhone: order.recipientPhone || null,
      shippingAddress: {
        street: order.deliveryAddress?.street || '',
        city: order.deliveryAddress?.city || '',
        state: order.deliveryAddress?.state || '',
        zip: order.deliveryAddress?.zip || '',
        country: 'US',
      },
      lineItems: (order.items ?? []).map(item => ({
        name: item.description || item.productCode || 'Floral Arrangement',
        quantity: item.quantity || 1,
        price: item.price,
      })),
      totalWeight: null,
      notes: order.specialInstructions || null,
      createdAt: order.createdAt || new Date().toISOString(),
      rawData: order as unknown as Record<string, unknown>,
    };
  }
}

// ── FTD API types (subset) ────────────────────────────────────────────

interface FTDOrder {
  id: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  cardMessage?: string;
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  items?: Array<{
    productCode?: string;
    description?: string;
    quantity?: number;
    price?: number;
  }>;
  deliveryDate?: string;
  specialInstructions?: string;
  createdAt?: string;
}
