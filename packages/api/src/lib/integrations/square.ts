import type { EcommerceConnector, ExternalOrder } from './connector.js';

/**
 * Square POS connector for restaurant delivery orders.
 * Uses Square Orders API (REST, bearer token auth).
 * Docs: https://developer.squareup.com/reference/square/orders-api
 */
export class SquareConnector implements EcommerceConnector {
  platform = 'square';

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/v2/locations/${credentials.locationId}`, {
        headers: this.headers(credentials),
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
    const ids: string[] = [];

    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/v2/webhooks/subscriptions`, {
        method: 'POST',
        headers: this.headers(credentials),
        body: JSON.stringify({
          subscription: {
            name: 'HOMER.io Order Sync',
            enabled: true,
            event_types: ['order.created', 'order.updated'],
            notification_url: callbackUrl,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = await res.json() as { subscription: { id: string } };
        ids.push(data.subscription.id);
      }
    } catch {
      // Webhook registration is supplementary to polling
    }

    return ids;
  }

  async fetchOrders(
    storeUrl: string,
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ExternalOrder[]> {
    const body: Record<string, unknown> = {
      location_ids: [credentials.locationId],
      query: {
        filter: {
          state_filter: { states: ['OPEN', 'COMPLETED'] },
          fulfillment_filter: {
            fulfillment_types: ['DELIVERY'],
          },
        },
        sort: { sort_field: 'CREATED_AT', sort_order: 'DESC' },
      },
      limit: 100,
    };

    if (since) {
      (body.query as Record<string, unknown>).filter = {
        ...((body.query as Record<string, unknown>).filter as Record<string, unknown>),
        date_time_filter: {
          created_at: { start_at: since.toISOString() },
        },
      };
    }

    const res = await fetch(`${this.apiBase(storeUrl)}/v2/orders/search`, {
      method: 'POST',
      headers: this.headers(credentials),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Square API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { orders?: SquareOrder[] };
    return (data.orders ?? []).map(o => this.toExternal(o));
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const raw = externalOrder.rawData as unknown as SquareOrder;
    const totalItems = externalOrder.lineItems.reduce((sum, li) => sum + li.quantity, 0);

    const itemSummary = externalOrder.lineItems
      .map(li => `${li.quantity}x ${li.name}${li.price ? ` ($${(li.price / 100).toFixed(2)})` : ''}`)
      .join(', ');

    // Extract delivery notes from fulfillment
    const fulfillment = (raw.fulfillments ?? []).find(f => f.type === 'DELIVERY');
    const deliveryNote = fulfillment?.delivery_details?.note || '';
    const scheduledAt = fulfillment?.delivery_details?.scheduled_at || '';

    const notes = [
      `Square #${externalOrder.orderNumber}: ${itemSummary}`,
      deliveryNote ? `Delivery notes: ${deliveryNote}` : '',
      scheduledAt ? `Scheduled: ${scheduledAt}` : '',
    ].filter(Boolean).join(' | ');

    return {
      tenantId,
      externalId: `square_${externalOrder.externalId}`,
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
      notes,
    };
  }

  // -- Private helpers --

  private apiBase(storeUrl: string): string {
    // Square API is always at connect.squareup.com; storeUrl is used for env distinction
    const host = storeUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    if (host.includes('squareup') || host.includes('square')) {
      return `https://${host}`;
    }
    return 'https://connect.squareup.com';
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Square-Version': '2024-01-18',
    };
  }

  private toExternal(order: SquareOrder): ExternalOrder {
    const fulfillment = (order.fulfillments ?? []).find(f => f.type === 'DELIVERY');
    const recipient = fulfillment?.delivery_details?.recipient ?? {};

    return {
      externalId: order.id,
      orderNumber: order.reference_id || order.id.slice(0, 8),
      customerName: recipient.display_name
        || [recipient.given_name, recipient.family_name].filter(Boolean).join(' ')
        || 'Unknown',
      customerEmail: recipient.email_address || null,
      customerPhone: recipient.phone_number || null,
      shippingAddress: {
        street: recipient.address?.address_line_1
          ? [recipient.address.address_line_1, recipient.address.address_line_2].filter(Boolean).join(', ')
          : '',
        city: recipient.address?.locality || '',
        state: recipient.address?.administrative_district_level_1 || '',
        zip: recipient.address?.postal_code || '',
        country: recipient.address?.country || 'US',
      },
      lineItems: (order.line_items ?? []).map(item => ({
        name: item.name || 'Menu Item',
        quantity: parseInt(item.quantity || '1', 10),
        price: item.base_price_money?.amount
          ? item.base_price_money.amount / 100
          : undefined,
      })),
      totalWeight: null, // Restaurant orders don't typically have weight
      notes: fulfillment?.delivery_details?.note || order.note || null,
      createdAt: order.created_at || new Date().toISOString(),
      rawData: order as unknown as Record<string, unknown>,
    };
  }
}

// -- Square API types (subset) --

interface SquareAddress {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  administrative_district_level_1?: string;
  postal_code?: string;
  country?: string;
}

interface SquareRecipient {
  display_name?: string;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  address?: SquareAddress;
}

interface SquareDeliveryDetails {
  recipient?: SquareRecipient;
  note?: string;
  scheduled_at?: string;
  placed_at?: string;
}

interface SquareFulfillment {
  uid?: string;
  type: string;
  state?: string;
  delivery_details?: SquareDeliveryDetails;
}

interface SquareMoney {
  amount: number;
  currency: string;
}

interface SquareLineItem {
  uid?: string;
  name?: string;
  quantity?: string;
  base_price_money?: SquareMoney;
  total_money?: SquareMoney;
}

interface SquareOrder {
  id: string;
  reference_id?: string;
  location_id: string;
  line_items?: SquareLineItem[];
  fulfillments?: SquareFulfillment[];
  note?: string;
  total_money?: SquareMoney;
  state?: string;
  created_at?: string;
}
