import { create } from 'zustand';
import { api } from '../api/client.js';
import { guardDemoWrite } from './demo.js';
import type { UpdateOrgSettingsInput, InviteUserInput, ApiKeyCreateInput, Role } from '@homer-io/shared';

interface OrgSettings {
  id: string;
  tenantId: string;
  timezone: string;
  units: string;
  branding: Record<string, unknown>;
  notificationPrefs: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ApiKeyCreateResponse extends ApiKey {
  key: string;
}

interface InviteResponse extends TeamMember {
  tempPassword: string;
}

interface SettingsState {
  orgSettings: OrgSettings | null;
  teamMembers: TeamMember[];
  apiKeys: ApiKey[];
  loading: boolean;

  fetchSettings: () => Promise<void>;
  updateSettings: (input: UpdateOrgSettingsInput) => Promise<void>;

  fetchTeam: () => Promise<void>;
  inviteUser: (input: InviteUserInput) => Promise<InviteResponse>;
  updateRole: (userId: string, role: Role) => Promise<void>;
  deactivateUser: (userId: string) => Promise<void>;

  fetchApiKeys: () => Promise<void>;
  createApiKey: (input: ApiKeyCreateInput) => Promise<ApiKeyCreateResponse>;
  revokeApiKey: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  orgSettings: null,
  teamMembers: [],
  apiKeys: [],
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const settings = await api.get<OrgSettings>('/settings/organization');
      set({ orgSettings: settings });
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (input) => {
    guardDemoWrite('Updating settings');
    const settings = await api.put<OrgSettings>('/settings/organization', input);
    set({ orgSettings: settings });
  },

  fetchTeam: async () => {
    set({ loading: true });
    try {
      const members = await api.get<TeamMember[]>('/team');
      set({ teamMembers: members });
    } finally {
      set({ loading: false });
    }
  },

  inviteUser: async (input) => {
    guardDemoWrite('Inviting users');
    const result = await api.post<InviteResponse>('/team/invite', input);
    await get().fetchTeam();
    return result;
  },

  updateRole: async (userId, role) => {
    guardDemoWrite('Updating roles');
    await api.put(`/team/${userId}/role`, { role });
    await get().fetchTeam();
  },

  deactivateUser: async (userId) => {
    guardDemoWrite('Deactivating users');
    await api.delete(`/team/${userId}`);
    await get().fetchTeam();
  },

  fetchApiKeys: async () => {
    set({ loading: true });
    try {
      const keys = await api.get<ApiKey[]>('/api-keys');
      set({ apiKeys: keys });
    } finally {
      set({ loading: false });
    }
  },

  createApiKey: async (input) => {
    guardDemoWrite('Creating API keys');
    const result = await api.post<ApiKeyCreateResponse>('/api-keys', input);
    await get().fetchApiKeys();
    return result;
  },

  revokeApiKey: async (id) => {
    guardDemoWrite('Revoking API keys');
    await api.delete(`/api-keys/${id}`);
    await get().fetchApiKeys();
  },
}));
