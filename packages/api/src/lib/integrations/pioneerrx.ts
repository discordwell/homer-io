import type { EcommerceConnector, ExternalOrder } from './connector.js';

/**
 * PioneerRx pharmacy management system connector.
 * PioneerRx (by RedSail Technologies) is the leading independent pharmacy software.
 * Imports prescription delivery orders with HIPAA-safe handling.
 */
export class PioneerRxConnector implements EcommerceConnector {
  platform = 'pioneerrx';

  async validateCredentials(credentials: Record<string, string>, storeUrl: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase(storeUrl)}/pharmacy/info`, {
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
          events: ['prescription.ready_for_delivery', 'prescription.updated'],
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
      status: 'ready_for_delivery',
      limit: '100',
    });
    if (since) params.set('filled_after', since.toISOString());

    const res = await fetch(`${this.apiBase(storeUrl)}/prescriptions/delivery-queue?${params}`, {
      headers: this.headers(credentials),
    });

    if (!res.ok) {
      throw new Error(`PioneerRx API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { prescriptions: PioneerRxPrescription[] };
    return (data.prescriptions ?? []).map(rx => this.toExternal(rx));
  }

  mapOrderToHomer(externalOrder: ExternalOrder, tenantId: string) {
    const raw = externalOrder.rawData as unknown as PioneerRxPrescription;

    // HIPAA-safe: DO NOT put medication names in notes
    // Only put delivery instructions
    const hipaaSafeNotes = raw.deliveryInstructions || 'Prescription delivery';

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
      packageCount: raw.itemCount || 1,
      weight: externalOrder.totalWeight ? String(externalOrder.totalWeight) : null,
      // HIPAA: internal notes have RX details, driver notes do not
      notes: `RX: ${raw.rxNumbers?.join(', ') || externalOrder.externalId}`,
      hipaaSafeNotes,
      // Pharmacy-specific fields
      isControlledSubstance: raw.isControlled || false,
      controlledSchedule: raw.controlledSchedule || undefined,
      isColdChain: raw.requiresRefrigeration || false,
      patientDob: raw.patientDob || undefined,
      prescriberName: raw.prescriberName || undefined,
      prescriberNpi: raw.prescriberNpi || undefined,
      // RX numbers as barcodes for scanning
      barcodes: raw.rxNumbers || [],
      // Always require signature for pharmacy
      requiresSignature: true,
      requiresPhoto: true,
      // Copay
      cashAmount: raw.copayAmount || undefined,
      paymentMethod: raw.copayAmount ? ('cash' as const) : ('prepaid' as const),
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
      ...(credentials.pharmacyId ? { 'X-Pharmacy-Id': credentials.pharmacyId } : {}),
    };
  }

  private toExternal(rx: PioneerRxPrescription): ExternalOrder {
    return {
      externalId: rx.id || rx.rxNumbers?.[0] || '',
      orderNumber: rx.rxNumbers?.join(', ') || rx.id,
      customerName: rx.patientName || '',
      customerEmail: rx.patientEmail || null,
      customerPhone: rx.patientPhone || null,
      shippingAddress: {
        street: rx.deliveryAddress?.street || '',
        city: rx.deliveryAddress?.city || '',
        state: rx.deliveryAddress?.state || '',
        zip: rx.deliveryAddress?.zip || '',
        country: 'US',
      },
      lineItems: [{
        // HIPAA: use generic description, not medication name
        name: `Prescription${rx.itemCount && rx.itemCount > 1 ? ` (${rx.itemCount} items)` : ''}`,
        quantity: rx.itemCount || 1,
      }],
      totalWeight: null,
      notes: rx.deliveryInstructions || null,
      createdAt: rx.filledAt || new Date().toISOString(),
      rawData: rx as unknown as Record<string, unknown>,
    };
  }
}

// ── PioneerRx API types (subset) ──────────────────────────────────────

interface PioneerRxPrescription {
  id: string;
  rxNumbers?: string[];
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  patientDob?: string;
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  prescriberName?: string;
  prescriberNpi?: string;
  isControlled?: boolean;
  controlledSchedule?: string;
  requiresRefrigeration?: boolean;
  itemCount?: number;
  copayAmount?: number;
  deliveryInstructions?: string;
  filledAt?: string;
}
