import { create } from 'zustand';
import { api } from '@/api/client';

export interface RouteOrder {
  id: string;
  recipientName: string;
  deliveryAddress: { street: string; city: string; state: string; zip: string };
  deliveryLat: string | null;
  deliveryLng: string | null;
  status: string;
  packageCount: number;
  stopSequence: number | null;
}

export interface Route {
  id: string;
  name: string;
  status: string;
  driverId: string | null;
  vehicleId: string | null;
  totalStops: number;
  completedStops: number;
  totalDistance: string | null;
  totalDuration: number | null;
  createdAt: string;
  orders?: RouteOrder[];
}

interface RoutesState {
  routes: Route[];
  currentRoute: Route | null;
  loading: boolean;
  statusFilter: string | null;

  fetchRoutes: () => Promise<void>;
  fetchRoute: (id: string) => Promise<void>;
  setStatusFilter: (status: string | null) => void;
}

export const useRoutesStore = create<RoutesState>()((set, get) => ({
  routes: [],
  currentRoute: null,
  loading: false,
  statusFilter: null,

  fetchRoutes: async () => {
    set({ loading: true });
    try {
      const { statusFilter } = get();
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<{ items: Route[] }>(`/routes?${params}`);
      set({ routes: res.items });
    } catch (err) {
      console.error('Failed to fetch routes:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchRoute: async (id) => {
    set({ loading: true });
    try {
      const route = await api.get<Route>(`/routes/${id}`);
      set({ currentRoute: route });
    } catch (err) {
      console.error('Failed to fetch route:', err);
    } finally {
      set({ loading: false });
    }
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status });
    get().fetchRoutes();
  },
}));
