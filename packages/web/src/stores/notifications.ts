import { create } from 'zustand';
import { api } from '../api/client.js';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface PaginatedNotifications {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;

  fetchNotifications: (page?: number, readFilter?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (page = 1, readFilter?: boolean) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (readFilter !== undefined) params.set('read', String(readFilter));
      const res = await api.get<PaginatedNotifications>(`/notifications?${params}`);
      set({ notifications: res.items });
    } finally {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      set({ unreadCount: res.count });
    } catch {
      // Silently fail on polling errors
    }
  },

  markAsRead: async (id) => {
    await api.patch(`/notifications/${id}/read`);
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    await api.post('/notifications/mark-all-read');
    set(state => ({
      notifications: state.notifications.map(n => ({
        ...n,
        readAt: n.readAt || new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  },
}));
