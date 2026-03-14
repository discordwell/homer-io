import { create } from 'zustand';
import { api } from '../api/client.js';
import type { CreateRouteInput } from '@homer-io/shared';

interface RouteOrder {
  id: string;
  recipientName: string;
  deliveryAddress: { street: string; city: string; state: string; zip: string; country: string };
  deliveryLat: string | null;
  deliveryLng: string | null;
  status: string;
  packageCount: number;
  stopSequence: number | null;
}

interface Route {
  id: string;
  name: string;
  status: string;
  driverId: string | null;
  vehicleId: string | null;
  totalStops: number;
  completedStops: number;
  totalDistance: string | null;
  totalDuration: number | null;
  optimizationNotes: string | null;
  waypoints: unknown[];
  createdAt: string;
  orders?: RouteOrder[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RoutesState {
  routes: Route[];
  page: number;
  totalPages: number;
  loading: boolean;
  statusFilter: string;
  currentRoute: Route | null;

  fetchRoutes: (page?: number) => Promise<void>;
  fetchRoute: (id: string) => Promise<void>;
  createRoute: (input: CreateRouteInput) => Promise<Route>;
  updateRoute: (id: string, input: Partial<CreateRouteInput>) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  optimizeRoute: (id: string) => Promise<{ message: string; optimized: boolean }>;
  setStatusFilter: (status: string) => void;
}

export const useRoutesStore = create<RoutesState>()((set, get) => ({
  routes: [],
  page: 1,
  totalPages: 1,
  loading: false,
  statusFilter: '',
  currentRoute: null,

  fetchRoutes: async (page = 1) => {
    set({ loading: true });
    try {
      const { statusFilter } = get();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<PaginatedResponse<Route>>(`/routes?${params}`);
      set({ routes: res.items, page: res.page, totalPages: res.totalPages });
    } finally {
      set({ loading: false });
    }
  },

  fetchRoute: async (id) => {
    const route = await api.get<Route>(`/routes/${id}`);
    set({ currentRoute: route });
  },

  createRoute: async (input) => {
    const route = await api.post<Route>('/routes', input);
    await get().fetchRoutes(get().page);
    return route;
  },

  updateRoute: async (id, input) => {
    await api.patch(`/routes/${id}`, input);
    await get().fetchRoutes(get().page);
  },

  deleteRoute: async (id) => {
    await api.delete(`/routes/${id}`);
    await get().fetchRoutes(get().page);
  },

  optimizeRoute: async (id) => {
    const result = await api.post<{ message: string; optimized: boolean; route: Route }>(`/routes/${id}/optimize`);
    if (result.route) set({ currentRoute: result.route });
    return { message: result.message, optimized: result.optimized };
  },

  setStatusFilter: (status) => set({ statusFilter: status }),
}));
