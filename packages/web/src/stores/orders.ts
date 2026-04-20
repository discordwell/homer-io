import { create } from 'zustand';
import { api, BillingError } from '../api/client.js';
import { guardDemoWrite } from './demo.js';

interface Order {
  id: string;
  externalId: string | null;
  status: string;
  priority: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryAddress: { street: string; city: string; state: string; zip: string; country: string };
  packageCount: number;
  weight: string | null;
  volume: string | null;
  notes: string | null;
  routeId: string | null;
  stopSequence: number | null;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OrdersState {
  orders: Order[];
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  search: string;
  dateFrom: string;
  dateTo: string;

  fetchOrders: (page?: number) => Promise<void>;
  createOrder: (input: Record<string, unknown>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  importCsv: (rows: Record<string, string>[]) => Promise<void>;
  setStatusFilter: (status: string) => void;
  setSearch: (search: string) => void;
  setDateFrom: (date: string) => void;
  setDateTo: (date: string) => void;
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders: [],
  page: 1,
  totalPages: 1,
  total: 0,
  loading: false,
  error: null,
  statusFilter: '',
  search: '',
  dateFrom: '',
  dateTo: '',

  fetchOrders: async (page = 1) => {
    set({ loading: true, error: null });
    try {
      const { statusFilter, search, dateFrom, dateTo } = get();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get<PaginatedResponse<Order>>(`/orders?${params}`);
      set({ orders: res.items, page: res.page, totalPages: res.totalPages, total: res.total, error: null });
    } catch (err) {
      set({
        orders: [],
        page: 1,
        totalPages: 1,
        total: 0,
        error: err instanceof BillingError ? null : (err instanceof Error ? err.message : 'Failed to load orders'),
      });
    } finally {
      set({ loading: false });
    }
  },

  createOrder: async (input) => {
    guardDemoWrite('Creating orders');
    await api.post('/orders', input);
    await get().fetchOrders(get().page);
  },

  deleteOrder: async (id) => {
    guardDemoWrite('Deleting orders');
    await api.delete(`/orders/${id}`);
    await get().fetchOrders(get().page);
  },

  importCsv: async (rows) => {
    guardDemoWrite('Importing orders');
    await api.post('/orders/import/csv', { orders: rows });
    await get().fetchOrders(1);
  },

  // Filter setters reset pagination to page 1 so the next fetch doesn't
  // request a now-out-of-range page (which would render an empty table).
  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setDateFrom: (date) => set({ dateFrom: date, page: 1 }),
  setDateTo: (date) => set({ dateTo: date, page: 1 }),
}));
