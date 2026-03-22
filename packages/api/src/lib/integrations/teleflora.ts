import type { EcommerceConnector, ExternalOrder } from './connector.js';

/**
 * Teleflora wire service connector.
 * Teleflora is FTD's main competitor — florists receive incoming orders
 * from Teleflora.com for local fulfillment and delivery.
 * API: Teleflora WinDSR / eFlorist platform
 */
export class TelefloraConnector implements EcommerceConnector {
  platform = 'teleflora';

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/shop/info`, {
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
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/webhooks`, {
        method: 'POST',
        headers: this.headers(credentials),
        body: JSON.stringify({
          url: callbackUrl,
          events: ['order.received'],
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
      status: 'new,accepted',
      limit: '100',
    });
    if (since) params.set('since', since.toISOString());

    const res = await fetch(`${this.apiBase(storeUrl)}/orders?${params}`, {
      headers: this.headers(credentials),
    });

    if (!res.ok) {
      throw new Error(`Teleflora API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { orders: TelefloraOrder[] };
    return (data.orders ?? []).map(o => this.toExternal(o));
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const raw = externalOrder.rawData as unknown as TelefloraOrder;
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
      notes: `Teleflora #${externalOrder.orderNumber}: ${itemSummary}`,
      // Florist-specific: sender + gift data
      senderName: raw.sender?.name || null,
      senderEmail: raw.sender?.email || null,
      senderPhone: raw.sender?.phone || null,
      giftMessage: raw.cardMessage || null,
      isGift: true,
      requiresPhoto: true,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private apiBase(storeUrl: string): string {
    const host = storeUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    return `https://${host}/api/v2`;
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': credentials.apiKey || '',
      ...(credentials.shopId ? { 'X-Shop-Id': credentials.shopId } : {}),
    };
  }

  private toExternal(order: TelefloraOrder): ExternalOrder {
    return {
      externalId: order.id || order.orderNumber,
      orderNumber: order.orderNumber || order.id,
      customerName: order.recipient?.name || '',
      customerEmail: order.recipient?.email || null,
      customerPhone: order.recipient?.phone || null,
      shippingAddress: {
        street: order.recipient?.address?.street || '',
        city: order.recipient?.address?.city || '',
        state: order.recipient?.address?.state || '',
        zip: order.recipient?.address?.zip || '',
        country: 'US',
      },
      lineItems: (order.items ?? []).map(item => ({
        name: item.name || item.code || 'Floral Arrangement',
        quantity: item.quantity || 1,
        price: item.price,
      })),
      totalWeight: null,
      notes: order.deliveryInstructions || null,
      createdAt: order.createdAt || new Date().toISOString(),
      rawData: order as unknown as Record<string, unknown>,
    };
  }
}

// ── Teleflora API types (subset) ──────────────────────────────────────

interface TelefloraOrder {
  id: string;
  orderNumber: string;
  sender?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  recipient?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  cardMessage?: string;
  items?: Array<{
    code?: string;
    name?: string;
    quantity?: number;
    price?: number;
  }>;
  deliveryDate?: string;
  deliveryInstructions?: string;
  createdAt?: string;
}
