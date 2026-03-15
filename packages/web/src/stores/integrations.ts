import { create } from 'zustand';
import { api } from '../api/client.js';
import type { ConnectionResponse, PlatformInfo, CreateConnectionInput, UpdateConnectionInput, IntegrationOrderResponse } from '@homer-io/shared';

interface PaginatedOrders {
  data: IntegrationOrderResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface IntegrationsState {
  connections: ConnectionResponse[];
  platforms: PlatformInfo[];
  loading: boolean;

  loadPlatforms: () => Promise<void>;
  loadConnections: () => Promise<void>;
  createConnection: (input: CreateConnectionInput) => Promise<void>;
  updateConnection: (id: string, input: UpdateConnectionInput) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<boolean>;
  syncConnection: (id: string) => Promise<{ imported: number; skipped: number; failed: number; total: number }>;
  loadOrders: (connectionId: string, page?: number, limit?: number) => Promise<PaginatedOrders>;
}

export const useIntegrationsStore = create<IntegrationsState>()((set, get) => ({
  connections: [],
  platforms: [],
  loading: false,

  loadPlatforms: async () => {
    const platforms = await api.get<PlatformInfo[]>('/integrations/platforms');
    set({ platforms });
  },

  loadConnections: async () => {
    set({ loading: true });
    try {
      const connections = await api.get<ConnectionResponse[]>('/integrations/connections');
      set({ connections });
    } finally {
      set({ loading: false });
    }
  },

  createConnection: async (input) => {
    await api.post('/integrations/connections', input);
    await get().loadConnections();
  },

  updateConnection: async (id, input) => {
    await api.put(`/integrations/connections/${id}`, input);
    await get().loadConnections();
  },

  deleteConnection: async (id) => {
    await api.delete(`/integrations/connections/${id}`);
    await get().loadConnections();
  },

  testConnection: async (id) => {
    const result = await api.post<{ success: boolean }>(`/integrations/connections/${id}/test`);
    return result.success;
  },

  syncConnection: async (id) => {
    const result = await api.post<{ imported: number; skipped: number; failed: number; total: number }>(
      `/integrations/connections/${id}/sync`,
    );
    await get().loadConnections();
    return result;
  },

  loadOrders: async (connectionId, page = 1, limit = 20) => {
    return api.get<PaginatedOrders>(`/integrations/connections/${connectionId}/orders?page=${page}&limit=${limit}`);
  },
}));
