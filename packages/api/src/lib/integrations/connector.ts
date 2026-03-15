/**
 * Platform-agnostic order representation from external e-commerce platforms.
 */
export interface ExternalOrder {
  externalId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    lat?: number;
    lng?: number;
  };
  lineItems: Array<{
    name: string;
    quantity: number;
    weight?: number;
    price?: number;
  }>;
  totalWeight: number | null;
  notes: string | null;
  createdAt: string;
  rawData: Record<string, unknown>;
}

/**
 * Common interface for all e-commerce platform connectors.
 */
export interface EcommerceConnector {
  platform: string;

  /** Validate that the provided credentials can access the store. */
  validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean>;

  /** Register webhook subscriptions on the external platform. Returns webhook IDs. */
  registerWebhooks(
    storeUrl: string,
    credentials: Record<string, string>,
    callbackUrl: string,
  ): Promise<string[]>;

  /** Fetch orders from the platform, optionally since a given date. */
  fetchOrders(
    storeUrl: string,
    credentials: Record<string, string>,
    since?: Date,
  ): Promise<ExternalOrder[]>;

  /** Map an external order to a HOMER-compatible order input structure. */
  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string): {
    tenantId: string;
    externalId: string;
    recipientName: string;
    recipientPhone: string | null;
    recipientEmail: string | null;
    deliveryAddress: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      coords?: { lat: number; lng: number };
    };
    packageCount: number;
    weight: string | null;
    notes: string | null;
  };
}
