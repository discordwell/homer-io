import { create } from 'zustand';
import { api } from '../api/client.js';
import type { SubscriptionResponse, InvoiceResponse } from '@homer-io/shared';

interface InvoicePaginated {
  data: InvoiceResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface BillingState {
  subscription: SubscriptionResponse | null;
  invoices: InvoiceResponse[];
  loading: boolean;

  loadSubscription: () => Promise<void>;
  loadInvoices: (page?: number) => Promise<void>;
  createCheckout: (plan: string, interval: string) => Promise<string>;
  createPortal: () => Promise<string>;
  changePlan: (plan: string, interval: string) => Promise<void>;
}

export const useBillingStore = create<BillingState>()((set, get) => ({
  subscription: null,
  invoices: [],
  loading: false,

  loadSubscription: async () => {
    set({ loading: true });
    try {
      const sub = await api.get<SubscriptionResponse>('/billing/subscription');
      set({ subscription: sub });
    } finally {
      set({ loading: false });
    }
  },

  loadInvoices: async (page = 1) => {
    try {
      const res = await api.get<InvoicePaginated>(`/billing/invoices?page=${page}&limit=10`);
      set({ invoices: res.data });
    } catch {
      // fail silently — empty state
    }
  },

  createCheckout: async (plan: string, interval: string) => {
    const res = await api.post<{ url: string }>('/billing/checkout', { plan, interval });
    return res.url;
  },

  createPortal: async () => {
    const res = await api.post<{ url: string }>('/billing/portal', {
      returnUrl: window.location.href,
    });
    return res.url;
  },

  changePlan: async (plan: string, interval: string) => {
    await api.post('/billing/change-plan', { plan, interval });
    await get().loadSubscription();
  },
}));
