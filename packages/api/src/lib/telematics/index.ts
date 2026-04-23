import type { TelematicsAdapter, TelematicsProvider } from './adapter.js';
import { samsaraAdapter } from './samsara.js';

export type {
  TelematicsAdapter,
  TelematicsProvider,
  AuthMaterial,
  AuthKind,
  FieldSpec,
  StartAuthContext,
  StartAuthResult,
  CompleteAuthInput,
  CompleteAuthResult,
  ProbeResult,
  NormalizedVehicle,
  NormalizedDriver,
  NormalizedPosition,
  NormalizedEvent,
  Page,
  RegisteredWebhook,
} from './adapter.js';

const adapters: Record<TelematicsProvider, TelematicsAdapter> = {
  samsara: samsaraAdapter,
  // motive: motiveAdapter,   // P3
  // geotab: geotabAdapter,   // P3
} as Record<TelematicsProvider, TelematicsAdapter>;

export function getTelematicsAdapter(provider: TelematicsProvider): TelematicsAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unsupported telematics provider: ${provider}`);
  return adapter;
}

export function listTelematicsAdapters(): TelematicsAdapter[] {
  return Object.values(adapters);
}
