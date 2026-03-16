import type { MigrationConnector } from './connector.js';
import type { MigrationPlatformInfo } from '@homer-io/shared';
import { TookanConnector } from './tookan.js';
import { OnfleetConnector } from './onfleet.js';
import { OptimoRouteConnector } from './optimoroute.js';
import { GetSwiftConnector } from './getswift.js';
import { CircuitConnector } from './circuit.js';

const connectors: Record<string, MigrationConnector> = {
  tookan: new TookanConnector(),
  onfleet: new OnfleetConnector(),
  optimoroute: new OptimoRouteConnector(),
  getswift: new GetSwiftConnector(),
  circuit: new CircuitConnector(),
};

export function getMigrationConnector(platform: string): MigrationConnector | undefined {
  return connectors[platform];
}

export const apiMigrationPlatforms = Object.keys(connectors);

export function getMigrationPlatformInfo(): MigrationPlatformInfo[] {
  return [
    { platform: 'tookan', name: 'Tookan', supportsApi: true, supportsVehicles: false, credentialHint: 'Tookan API key from Settings → API Keys' },
    { platform: 'onfleet', name: 'Onfleet', supportsApi: true, supportsVehicles: true, credentialHint: 'Onfleet API key from Settings → API & Webhooks' },
    { platform: 'optimoroute', name: 'OptimoRoute', supportsApi: true, supportsVehicles: false, credentialHint: 'OptimoRoute API key from Settings → Integrations' },
    { platform: 'speedyroute', name: 'SpeedyRoute', supportsApi: false, supportsVehicles: false, credentialHint: 'CSV export only — no API available' },
    { platform: 'getswift', name: 'GetSwift', supportsApi: true, supportsVehicles: false, credentialHint: 'GetSwift API key from Settings → API' },
    { platform: 'circuit', name: 'Circuit', supportsApi: true, supportsVehicles: false, credentialHint: 'Circuit API key from Team Settings → Integrations' },
  ];
}

export type { MigrationConnector, ExternalMigrationOrder, ExternalDriver, ExternalVehicle } from './connector.js';
