import type { EcommerceConnector, ExternalOrder } from './connector.js';

/**
 * Dutchie integration connector.
 * Dutchie is the leading cannabis e-commerce/POS platform.
 * API docs: https://dutchie.com/api (partner access required)
 */
export class DutchieConnector implements EcommerceConnector {
  platform = 'dutchie';

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/store`, {
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
    const topics = ['order.created', 'order.updated', 'order.cancelled'];
    const ids: string[] = [];

    for (const topic of topics) {
      try {
        const res = await fetch(`${this.apiBase(storeUrl)}/webhooks`, {
          method: 'POST',
          headers: this.headers(credentials),
          body: JSON.stringify({ topic, url: callbackUrl }),
        });
        if (res.ok) {
          const data = await res.json() as { id: string };
          ids.push(data.id);
        }
      } catch {
        // Non-critical — webhooks are supplementary to polling
      }
    }

    return ids;
  }

  async fetchOrders(
    storeUrl: string,
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ExternalOrder[]> {
    const params = new URLSearchParams({
      status: 'confirmed,ready,out_for_delivery,delivered',
      limit: '100',
      order_type: 'delivery',
    });
    if (since) {
      params.set('created_after', since.toISOString());
    }

    const res = await fetch(`${this.apiBase(storeUrl)}/orders?${params}`, {
      headers: this.headers(credentials),
    });

    if (!res.ok) {
      throw new Error(`Dutchie API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { orders: DutchieOrder[] };
    return (data.orders ?? []).map(o => this.toExternal(o));
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const totalPackages = externalOrder.lineItems.reduce((sum, li) => sum + li.quantity, 0);
    const cannabisFields: Record<string, string | number | boolean> = {};

    // Extract cannabis-specific data from rawData
    const raw = externalOrder.rawData as unknown as DutchieOrder;
    if (raw.medical) cannabisFields.medicalOrder = true;
    if (raw.patientId) cannabisFields.patientId = raw.patientId;

    // Map line items to barcodes/tracking tags
    const trackingTags: string[] = [];
    for (const item of (raw.items ?? [])) {
      if (item.trackingId) trackingTags.push(item.trackingId);
      if (item.category) cannabisFields[`category_${item.sku || item.name}`] = item.category;
      if (item.thcContent) cannabisFields[`thc_${item.sku || item.name}`] = item.thcContent;
      if (item.cbdContent) cannabisFields[`cbd_${item.sku || item.name}`] = item.cbdContent;
      if (item.strain) cannabisFields[`strain_${item.sku || item.name}`] = item.strain;
    }

    // Build notes with product details
    const itemSummary = externalOrder.lineItems
      .map(li => `${li.quantity}x ${li.name}${li.price ? ` ($${li.price.toFixed(2)})` : ''}`)
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
        ...(externalOrder.shippingAddress.lat && externalOrder.shippingAddress.lng
          ? { coords: { lat: externalOrder.shippingAddress.lat, lng: externalOrder.shippingAddress.lng } }
          : {}),
      },
      packageCount: totalPackages,
      weight: externalOrder.totalWeight ? String(externalOrder.totalWeight) : null,
      notes: `Dutchie #${externalOrder.orderNumber}: ${itemSummary}`,
      customFields: cannabisFields,
      barcodes: trackingTags,
      requiresSignature: true,
      cashAmount: raw.paymentMethod === 'cash' ? raw.total : undefined,
      paymentMethod: raw.paymentMethod === 'cash' ? 'cash' as const : 'prepaid' as const,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private apiBase(storeUrl: string): string {
    // Dutchie API base — normalize the store URL
    const host = storeUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    return `https://${host}/api/v1`;
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credentials.apiKey}`,
      ...(credentials.dispensaryId ? { 'X-Dispensary-Id': credentials.dispensaryId } : {}),
    };
  }

  private toExternal(order: DutchieOrder): ExternalOrder {
    return {
      externalId: order.id,
      orderNumber: order.orderNumber || order.id,
      customerName: order.customerName || `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim(),
      customerEmail: order.customerEmail || null,
      customerPhone: order.customerPhone || null,
      shippingAddress: {
        street: order.deliveryAddress?.street || '',
        city: order.deliveryAddress?.city || '',
        state: order.deliveryAddress?.state || '',
        zip: order.deliveryAddress?.zip || '',
        country: 'US',
        lat: order.deliveryAddress?.lat,
        lng: order.deliveryAddress?.lng,
      },
      lineItems: (order.items ?? []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        weight: item.weight,
        price: item.price,
      })),
      totalWeight: (order.items ?? []).reduce((sum, i) => sum + (i.weight || 0) * i.quantity, 0) || null,
      notes: order.notes || null,
      createdAt: order.createdAt || new Date().toISOString(),
      rawData: order as unknown as Record<string, unknown>,
    };
  }
}

// ── Dutchie API types (subset) ────────────────────────────────────────

interface DutchieOrder {
  id: string;
  orderNumber?: string;
  customerName?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  items?: DutchieItem[];
  notes?: string;
  total?: number;
  medical?: boolean;
  patientId?: string;
  paymentMethod?: string;
  createdAt?: string;
}

interface DutchieItem {
  name: string;
  sku?: string;
  quantity: number;
  weight?: number;
  price?: number;
  trackingId?: string;
  category?: string;
  thcContent?: string;
  cbdContent?: string;
  strain?: string;
}
