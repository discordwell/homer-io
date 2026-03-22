import type { EcommerceConnector, ExternalOrder } from './connector.js';

/**
 * Toast POS connector for restaurant delivery orders.
 * Uses Toast Orders API (REST, partner API key auth).
 * Docs: https://doc.toasttab.com/openapi/orders
 */
export class ToastConnector implements EcommerceConnector {
  platform = 'toast';

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/restaurants/${credentials.restaurantGuid}`, {
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
      const res = await fetch(`${this.apiBase(storeUrl)}/webhooks/v1/subscriptions`, {
        method: 'POST',
        headers: this.headers(credentials),
        body: JSON.stringify({
          webhookUrl: callbackUrl,
          eventTypes: ['ORDER_CREATED', 'ORDER_UPDATED'],
          notificationEmails: [],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = await res.json() as { subscriptionId: string };
        ids.push(data.subscriptionId);
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
    const params = new URLSearchParams({
      pageSize: '100',
      fulfillmentStatus: 'NEW,IN_PROGRESS',
    });
    if (since) {
      params.set('startDate', since.toISOString());
    }

    const res = await fetch(
      `${this.apiBase(storeUrl)}/orders/v2/orders?${params}`,
      {
        headers: {
          ...this.headers(credentials),
          'Toast-Restaurant-External-ID': credentials.restaurantGuid,
        },
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      throw new Error(`Toast API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as ToastOrder[];
    return (data ?? [])
      .filter(o => o.diningOption === 'DELIVERY')
      .map(o => this.toExternal(o));
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const raw = externalOrder.rawData as unknown as ToastOrder;
    const totalItems = externalOrder.lineItems.reduce((sum, li) => sum + li.quantity, 0);

    const itemSummary = externalOrder.lineItems
      .map(li => `${li.quantity}x ${li.name}${li.price ? ` ($${li.price.toFixed(2)})` : ''}`)
      .join(', ');

    // Extract delivery-specific info
    const deliveryInfo = raw.deliveryInfo;
    const scheduledTime = deliveryInfo?.deliverByDatetime || '';

    const notes = [
      `Toast #${externalOrder.orderNumber}: ${itemSummary}`,
      deliveryInfo?.notes ? `Delivery notes: ${deliveryInfo.notes}` : '',
      scheduledTime ? `Deliver by: ${scheduledTime}` : '',
    ].filter(Boolean).join(' | ');

    return {
      tenantId,
      externalId: `toast_${externalOrder.externalId}`,
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
    const host = storeUrl.replace(/\/$/, '').replace(/^https?:\/\//, '');
    if (host.includes('toasttab') || host.includes('toast')) {
      return `https://${host}`;
    }
    return 'https://ws-api.toasttab.com';
  }

  private headers(credentials: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${credentials.apiKey}`,
    };
  }

  private toExternal(order: ToastOrder): ExternalOrder {
    const customer = order.customer;
    const delivery = order.deliveryInfo;

    return {
      externalId: order.guid,
      orderNumber: order.externalId || order.displayNumber || order.guid.slice(0, 8),
      customerName: customer
        ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
        : 'Unknown',
      customerEmail: customer?.email || null,
      customerPhone: customer?.phone || null,
      shippingAddress: {
        street: delivery?.address
          ? [delivery.address.address1, delivery.address.address2].filter(Boolean).join(', ')
          : '',
        city: delivery?.address?.city || '',
        state: delivery?.address?.state || '',
        zip: delivery?.address?.zip || '',
        country: 'US',
        lat: delivery?.address?.latitude,
        lng: delivery?.address?.longitude,
      },
      lineItems: (order.selections ?? []).map(item => ({
        name: item.displayName || item.itemName || 'Menu Item',
        quantity: item.quantity || 1,
        price: item.price ? item.price : undefined,
      })),
      totalWeight: null, // Restaurant orders don't typically have weight
      notes: delivery?.notes || order.specialInstructions || null,
      createdAt: order.createdDate || new Date().toISOString(),
      rawData: order as unknown as Record<string, unknown>,
    };
  }
}

// -- Toast API types (subset) --

interface ToastAddress {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface ToastCustomer {
  guid?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface ToastDeliveryInfo {
  address?: ToastAddress;
  deliverByDatetime?: string;
  dispatchedDatetime?: string;
  notes?: string;
}

interface ToastSelection {
  guid?: string;
  displayName?: string;
  itemName?: string;
  quantity?: number;
  price?: number;
}

interface ToastOrder {
  guid: string;
  externalId?: string;
  displayNumber?: string;
  diningOption?: string;
  customer?: ToastCustomer;
  deliveryInfo?: ToastDeliveryInfo;
  selections?: ToastSelection[];
  specialInstructions?: string;
  totalAmount?: number;
  createdDate?: string;
}
