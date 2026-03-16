export interface ExternalMigrationOrder {
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
    lat?: number;
    lng?: number;
  };
  packageCount: number;
  weight: number | null;
  notes: string | null;
  createdAt: string;
  rawData: Record<string, unknown>;
}

export interface ExternalDriver {
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  rawData: Record<string, unknown>;
}

export interface ExternalVehicle {
  externalId: string;
  name: string;
  type: string;
  licensePlate: string | null;
  rawData: Record<string, unknown>;
}

export interface MigrationConnector {
  platform: string;
  validateCredentials(apiKey: string): Promise<boolean>;
  fetchOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]>;
  fetchDrivers(apiKey: string): Promise<ExternalDriver[]>;
  fetchVehicles(apiKey: string): Promise<ExternalVehicle[]>;
  getCounts(apiKey: string): Promise<{ orders?: number; drivers?: number; vehicles?: number }>;
}
