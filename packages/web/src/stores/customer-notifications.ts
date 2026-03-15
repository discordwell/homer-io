import { create } from 'zustand';
import { api } from '../api/client.js';

interface NotificationTemplate {
  id: string;
  tenantId: string;
  trigger: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationLogEntry {
  id: string;
  tenantId: string;
  orderId: string;
  channel: string;
  trigger: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  providerId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface PaginatedLog {
  data: NotificationLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateTemplateInput {
  trigger: string;
  channel: string;
  subject?: string;
  bodyTemplate: string;
  isActive?: boolean;
}

interface UpdateTemplateInput {
  trigger?: string;
  channel?: string;
  subject?: string;
  bodyTemplate?: string;
  isActive?: boolean;
}

interface CustomerNotificationsState {
  templates: NotificationTemplate[];
  log: NotificationLogEntry[];
  logPagination: { page: number; totalPages: number; total: number };
  loading: boolean;
  logLoading: boolean;

  fetchTemplates: () => Promise<void>;
  createTemplate: (input: CreateTemplateInput) => Promise<NotificationTemplate>;
  updateTemplate: (id: string, input: UpdateTemplateInput) => Promise<NotificationTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  testTemplate: (id: string) => Promise<{ success: boolean; message: string; renderedBody?: string }>;

  fetchLog: (page?: number) => Promise<void>;
}

export const useCustomerNotificationsStore = create<CustomerNotificationsState>()((set, get) => ({
  templates: [],
  log: [],
  logPagination: { page: 1, totalPages: 1, total: 0 },
  loading: false,
  logLoading: false,

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const templates = await api.get<NotificationTemplate[]>('/settings/notification-templates');
      set({ templates });
    } finally {
      set({ loading: false });
    }
  },

  createTemplate: async (input) => {
    const template = await api.post<NotificationTemplate>('/settings/notification-templates', input);
    await get().fetchTemplates();
    return template;
  },

  updateTemplate: async (id, input) => {
    const template = await api.put<NotificationTemplate>(`/settings/notification-templates/${id}`, input);
    await get().fetchTemplates();
    return template;
  },

  deleteTemplate: async (id) => {
    await api.delete(`/settings/notification-templates/${id}`);
    await get().fetchTemplates();
  },

  testTemplate: async (id) => {
    return api.post<{ success: boolean; message: string; renderedBody?: string }>(
      `/settings/notification-templates/${id}/test`,
    );
  },

  fetchLog: async (page = 1) => {
    set({ logLoading: true });
    try {
      const result = await api.get<PaginatedLog>(`/notifications/customer-log?page=${page}&limit=25`);
      set({
        log: result.data,
        logPagination: {
          page: result.pagination.page,
          totalPages: result.pagination.totalPages,
          total: result.pagination.total,
        },
      });
    } finally {
      set({ logLoading: false });
    }
  },
}));

export type { NotificationTemplate, NotificationLogEntry, CreateTemplateInput, UpdateTemplateInput };
