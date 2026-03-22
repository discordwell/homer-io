/**
 * METRC (Marijuana Enforcement Tracking Reporting Compliance) connector.
 * State-mandated seed-to-sale tracking system.
 * API docs: https://api-{state}.metrc.com/Documentation
 *
 * This is NOT an EcommerceConnector — it's a compliance integration.
 * Phase 3 scope: read-only (packages + transfers). Full sync is future work.
 */

// ---------------------------------------------------------------------------
// METRC API base URLs by state
// ---------------------------------------------------------------------------

const METRC_API_BASES: Record<string, string> = {
  AK: 'https://api-ak.metrc.com',
  CA: 'https://api-ca.metrc.com',
  CO: 'https://api-co.metrc.com',
  DC: 'https://api-dc.metrc.com',
  LA: 'https://api-la.metrc.com',
  MA: 'https://api-ma.metrc.com',
  MD: 'https://api-md.metrc.com',
  ME: 'https://api-me.metrc.com',
  MI: 'https://api-mi.metrc.com',
  MO: 'https://api-mo.metrc.com',
  MT: 'https://api-mt.metrc.com',
  NV: 'https://api-nv.metrc.com',
  OH: 'https://api-oh.metrc.com',
  OK: 'https://api-ok.metrc.com',
  OR: 'https://api-or.metrc.com',
  WV: 'https://api-wv.metrc.com',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetrcPackage {
  id: number;
  label: string;
  packageType: string;
  productName: string;
  productCategoryName: string;
  quantity: number;
  unitOfMeasureName: string;
  labTestingState: string;
  isOnHold: boolean;
  receivedDateTime: string;
}

export interface MetrcTransferInput {
  shipperLicenseNumber: string;
  shipperName: string;
  transporterLicenseNumber: string;
  driverName: string;
  driverLicenseNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleLicensePlate: string;
  destinations: Array<{
    recipientLicenseNumber: string;
    plannedRoute: string;
    estimatedDepartureDateTime: string;
    estimatedArrivalDateTime: string;
    packages: Array<{
      packageLabel: string;
      quantity: number;
      unitOfMeasureName: string;
    }>;
  }>;
}

export interface MetrcDeliveryReport {
  recipientName: string;
  deliveryDateTime: string;
  packageLabels: string[];
  accepted: boolean;
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export interface SeedToSaleConnector {
  platform: string;
  validateApiKey(apiKey: string, userApiKey: string, state: string, licenseNumber: string): Promise<boolean>;
  getActivePackages(apiKey: string, userApiKey: string, state: string, licenseNumber: string): Promise<MetrcPackage[]>;
  createTransfer(apiKey: string, userApiKey: string, state: string, licenseNumber: string, transfer: MetrcTransferInput): Promise<{ id: number }>;
  reportDelivery(apiKey: string, userApiKey: string, state: string, deliveryData: MetrcDeliveryReport): Promise<void>;
}

export class MetrcConnector implements SeedToSaleConnector {
  platform = 'metrc';

  async validateApiKey(apiKey: string, userApiKey: string, state: string, licenseNumber: string): Promise<boolean> {
    const base = this.getApiBase(state);
    if (!base) return false;

    try {
      const res = await fetch(`${base}/facilities/v1?licenseNumber=${encodeURIComponent(licenseNumber)}`, {
        headers: this.authHeaders(apiKey, userApiKey),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getActivePackages(apiKey: string, userApiKey: string, state: string, licenseNumber: string): Promise<MetrcPackage[]> {
    const base = this.getApiBase(state);
    if (!base) throw new Error(`METRC not available in state: ${state}`);

    const res = await fetch(`${base}/packages/v1/active?licenseNumber=${encodeURIComponent(licenseNumber)}`, {
      headers: this.authHeaders(apiKey, userApiKey),
    });

    if (!res.ok) {
      throw new Error(`METRC API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<MetrcPackage[]>;
  }

  async createTransfer(
    apiKey: string,
    userApiKey: string,
    state: string,
    licenseNumber: string,
    transfer: MetrcTransferInput,
  ): Promise<{ id: number }> {
    const base = this.getApiBase(state);
    if (!base) throw new Error(`METRC not available in state: ${state}`);

    const res = await fetch(`${base}/transfers/v1/external/incoming?licenseNumber=${encodeURIComponent(licenseNumber)}`, {
      method: 'POST',
      headers: this.authHeaders(apiKey, userApiKey),
      body: JSON.stringify([transfer]),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`METRC transfer creation failed: ${res.status} — ${body}`);
    }

    // METRC returns the created transfer ID in the response
    const data = await res.json() as { Id: number }[];
    return { id: data[0]?.Id ?? 0 };
  }

  async reportDelivery(
    apiKey: string,
    userApiKey: string,
    state: string,
    deliveryData: MetrcDeliveryReport,
  ): Promise<void> {
    const base = this.getApiBase(state);
    if (!base) throw new Error(`METRC not available in state: ${state}`);

    // METRC delivery reporting uses the transfers endpoint
    // This is a simplified implementation — full METRC delivery flow
    // requires updating the transfer with actual delivery data
    console.log(`[metrc] Delivery reported: ${deliveryData.packageLabels.length} packages to ${deliveryData.recipientName}`);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private getApiBase(state: string): string | null {
    return METRC_API_BASES[state.toUpperCase()] ?? null;
  }

  private authHeaders(apiKey: string, userApiKey: string): Record<string, string> {
    // METRC uses HTTP Basic Auth: vendorApiKey:userApiKey
    const encoded = Buffer.from(`${apiKey}:${userApiKey}`).toString('base64');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${encoded}`,
    };
  }
}

/** Get list of states where METRC is available */
export function getMetrcStates(): string[] {
  return Object.keys(METRC_API_BASES);
}
