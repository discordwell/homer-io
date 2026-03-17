import { create } from 'zustand';
import { api } from '../api/client.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  isOpen: boolean;

  sendMessage: (message: string) => Promise<void>;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  loading: false,
  isOpen: false,

  sendMessage: async (message) => {
    const { messages } = get();
    const userMsg: ChatMessage = { role: 'user', content: message };
    set({ messages: [...messages, userMsg], loading: true });

    try {
      const res = await api.post<{ reply: string }>('/ai/chat', {
        message,
        history: messages,
      });
      set({ messages: [...get().messages, { role: 'assistant', content: res.reply }] });
    } catch {
      set({
        messages: [
          ...get().messages,
          { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
        ],
      });
    } finally {
      set({ loading: false });
    }
  },

  toggle: () => set({ isOpen: !get().isOpen }),
  setOpen: (open) => set({ isOpen: open }),
  clear: () => set({ messages: [] }),
}));
