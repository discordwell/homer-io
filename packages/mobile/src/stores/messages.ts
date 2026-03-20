import { create } from 'zustand';
import { api } from '@/api/client';

export interface ChatMessage {
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
  messages: ChatMessage[];
  unreadCount: number;
  loading: boolean;

  fetchMessages: (routeId?: string) => Promise<void>;
  sendMessage: (input: { routeId?: string; recipientId?: string; body: string }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  addMessage: (message: ChatMessage) => void;
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
      const items = await api.get<ChatMessage[]>(`/messages?${params}`);
      set({ messages: items.reverse() });
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (input) => {
    const message = await api.post<ChatMessage>('/messages', input);
    set((state) => ({ messages: [...state.messages, message] }));
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
