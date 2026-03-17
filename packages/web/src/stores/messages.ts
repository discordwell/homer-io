import { create } from 'zustand';
import { api } from '../api/client.js';

interface Message {
  id: string;
  routeId: string | null;
  senderId: string;
  senderName: string | null;
  recipientId: string | null;
  body: string;
  attachmentUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface MessagesState {
  messages: Message[];
  unreadCount: number;
  loading: boolean;

  fetchMessages: (routeId?: string) => Promise<void>;
  sendMessage: (input: { routeId?: string; recipientId?: string; body: string; attachmentUrl?: string }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  addMessage: (message: Message) => void;
}

export const useMessagesStore = create<MessagesState>()((set) => ({
  messages: [],
  unreadCount: 0,
  loading: false,

  fetchMessages: async (routeId) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (routeId) params.set('routeId', routeId);
      const items = await api.get<Message[]>(`/messages?${params}`);
      set({ messages: items.reverse() });
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (input) => {
    const message = await api.post<Message>('/messages', input);
    set((state) => ({ messages: [...state.messages, message] }));
  },

  markAsRead: async (id) => {
    await api.patch(`/messages/${id}/read`);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, readAt: new Date().toISOString() } : m,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  fetchUnreadCount: async () => {
    const result = await api.get<{ count: number }>('/messages/unread-count');
    set({ unreadCount: result.count });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
