import { create } from 'zustand';
import { api } from '@/api/client';

export interface Order {
  id: string;
  status: string;
  priority: string;
  recipientName: string;
  recipientPhone: string | null;
  deliveryAddress: { street: string; city: string; state: string; zip: string };
  packageCount: number;
  weight: string | null;
  notes: string | null;
  routeId: string | null;
  createdAt: string;
}

interface OrdersState {
  orders: Order[];
  total: number;
  loading: boolean;
  statusFilter: string | null;
  search: string;

  fetchOrders: () => Promise<void>;
  setStatusFilter: (status: string | null) => void;
  setSearch: (search: string) => void;
  updateOrderStatus: (id: string, status: string) => Promise<void>;
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders: [],
  total: 0,
  loading: false,
  statusFilter: null,
  search: '',

  fetchOrders: async () => {
    set({ loading: true });
    try {
      const { statusFilter, search } = get();
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await api.get<{ items: Order[]; total: number }>(`/orders?${params}`);
      set({ orders: res.items, total: res.total });
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      set({ loading: false });
    }
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status });
    get().fetchOrders();
  },

  setSearch: (search) => {
    set({ search });
    get().fetchOrders();
  },

  updateOrderStatus: async (id, status) => {
    await api.patch(`/orders/${id}`, { status });
    await get().fetchOrders();
  },
}));
