import { create } from 'zustand';
import { api } from '../api/client.js';

export type TelematicsProvider = 'samsara' | 'motive' | 'geotab';
export type TelematicsStatus = 'active' | 'pending_reauth' | 'error' | 'disabled';

export interface TelematicsProviderInfo {
  provider: TelematicsProvider;
  name: string;
  description: string;
  authKind: 'oauth' | 'api_key';
}

export interface TelematicsConnectionSummary {
  id: string;
  provider: TelematicsProvider;
  accountName: string | null;
  status: TelematicsStatus;
  disabledReason: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface TelematicsConnectionDetail extends TelematicsConnectionSummary {
  vehicleCount: number;
  mappedVehicleCount: number;
}

export interface ExternalVehicleRow {
  id: string;
  externalVehicleId: string;
  name: string | null;
  vin: string | null;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  mappedVehicleId: string | null;
  suggestion: { vehicleId: string; vehicleName: string; reason: 'plate_match' } | null;
}

type StartResult =
  | { kind: 'oauth'; redirectUrl: string; state: string }
  | { kind: 'api_key'; fields: Array<{ key: string; label: string; type: 'text' | 'password'; placeholder?: string }>; state: string };

interface TelematicsState {
  providers: TelematicsProviderInfo[];
  connections: TelematicsConnectionSummary[];
  loading: boolean;

  loadProviders: () => Promise<void>;
  loadConnections: () => Promise<void>;
  getConnection: (id: string) => Promise<TelematicsConnectionDetail>;
  startConnect: (provider: TelematicsProvider, redirectUri?: string) => Promise<StartResult>;
  completeConnect: (
    provider: TelematicsProvider,
    body: { state: string; code?: string; redirectUri?: string; credentials?: Record<string, string> },
  ) => Promise<{ connectionId: string }>;
  disconnect: (id: string) => Promise<void>;
  listVehicles: (connectionId: string) => Promise<ExternalVehicleRow[]>;
  linkVehicle: (connectionId: string, externalVehicleId: string, homerVehicleId: string | null) => Promise<void>;
}

export const useTelematicsStore = create<TelematicsState>()((set, get) => ({
  providers: [],
  connections: [],
  loading: false,

  loadProviders: async () => {
    const providers = await api.get<TelematicsProviderInfo[]>('/telematics/providers');
    set({ providers });
  },

  loadConnections: async () => {
    set({ loading: true });
    try {
      const connections = await api.get<TelematicsConnectionSummary[]>('/telematics/connections');
      set({ connections });
    } finally {
      set({ loading: false });
    }
  },

  getConnection: async (id) => {
    return api.get<TelematicsConnectionDetail>(`/telematics/connections/${id}`);
  },

  startConnect: async (provider, redirectUri) => {
    return api.post<StartResult>(`/telematics/connect/${provider}/start`, redirectUri ? { redirectUri } : {});
  },

  completeConnect: async (provider, body) => {
    const res = await api.post<{ connectionId: string }>(`/telematics/connect/${provider}/complete`, body);
    await get().loadConnections();
    return res;
  },

  disconnect: async (id) => {
    await api.delete(`/telematics/connections/${id}`);
    await get().loadConnections();
  },

  listVehicles: async (connectionId) => {
    return api.get<ExternalVehicleRow[]>(`/telematics/connections/${connectionId}/vehicles`);
  },

  linkVehicle: async (connectionId, externalVehicleId, homerVehicleId) => {
    await api.post(`/telematics/connections/${connectionId}/vehicles/link`, { externalVehicleId, homerVehicleId });
  },
}));
