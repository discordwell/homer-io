import { create } from 'zustand';
import { api } from '../api/client.js';
import type { MigrationJobResponse, CreateMigrationJobInput, MigrationPlatformInfo } from '@homer-io/shared';

interface PaginatedJobs {
  data: MigrationJobResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ValidationResult {
  valid: boolean;
  message?: string;
  counts?: { orders?: number; drivers?: number; vehicles?: number };
}

interface MigrationState {
  jobs: MigrationJobResponse[];
  currentJob: MigrationJobResponse | null;
  loading: boolean;
  creating: boolean;
  platformInfo: MigrationPlatformInfo[];

  loadJobs: (page?: number, limit?: number) => Promise<PaginatedJobs>;
  createJob: (input: CreateMigrationJobInput) => Promise<MigrationJobResponse>;
  getJob: (id: string) => Promise<MigrationJobResponse>;
  pollJob: (id: string) => Promise<MigrationJobResponse>;
  cancelJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  validateCredentials: (platform: string, apiKey: string) => Promise<ValidationResult>;
  loadPlatforms: () => Promise<void>;
}

export const useMigrationStore = create<MigrationState>()((set, get) => ({
  jobs: [],
  currentJob: null,
  loading: false,
  creating: false,
  platformInfo: [],

  loadJobs: async (page = 1, limit = 20) => {
    set({ loading: true });
    try {
      const result = await api.get<PaginatedJobs>(`/migrations?page=${page}&limit=${limit}`);
      set({ jobs: result.data });
      return result;
    } finally {
      set({ loading: false });
    }
  },

  createJob: async (input) => {
    set({ creating: true });
    try {
      const job = await api.post<MigrationJobResponse>('/migrations', input);
      set({ currentJob: job });
      await get().loadJobs();
      return job;
    } finally {
      set({ creating: false });
    }
  },

  getJob: async (id) => {
    const job = await api.get<MigrationJobResponse>(`/migrations/${id}`);
    set({ currentJob: job });
    return job;
  },

  pollJob: async (id) => {
    const job = await api.get<MigrationJobResponse>(`/migrations/${id}`);
    set({ currentJob: job });
    return job;
  },

  cancelJob: async (id) => {
    await api.post(`/migrations/${id}/cancel`);
    // Re-fetch instead of clearing to preserve UI state
    try {
      const job = await api.get<MigrationJobResponse>(`/migrations/${id}`);
      set({ currentJob: job });
    } catch {
      // Job may have been cleaned up
    }
    await get().loadJobs();
  },

  deleteJob: async (id) => {
    await api.delete(`/migrations/${id}`);
    await get().loadJobs();
  },

  validateCredentials: async (platform, apiKey) => {
    return await api.post<ValidationResult>('/migrations/validate', { platform, apiKey });
  },

  loadPlatforms: async () => {
    try {
      const info = await api.get<MigrationPlatformInfo[]>('/migrations/platforms');
      set({ platformInfo: info });
    } catch {
      // Non-critical, platform cards still work without API info
    }
  },
}));
