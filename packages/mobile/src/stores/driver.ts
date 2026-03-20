import { create } from 'zustand';
import { api } from '@/api/client';
import type { CreatePodInput } from '@homer-io/shared';

interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface OrderStop {
  id: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryAddress: DeliveryAddress;
  deliveryLat: string | null;
  deliveryLng: string | null;
  status: string;
  priority: string;
  packageCount: number;
  weight: string | null;
  notes: string | null;
  requiresSignature: boolean;
  requiresPhoto: boolean;
  stopSequence: number | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  completedAt: string | null;
}

export interface DriverRoute {
  id: string;
  name: string;
  status: string;
  driverId: string | null;
  vehicleId: string | null;
  totalStops: number;
  completedStops: number;
  depotAddress: unknown;
  depotLat: string | null;
  depotLng: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  totalDistance: string | null;
  totalDuration: number | null;
  orders: OrderStop[];
}

interface DriverProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
  currentVehicleId: string | null;
}

interface DriverState {
  currentRoute: DriverRoute | null;
  upcomingRoutes: DriverRoute[];
  profile: DriverProfile | null;
  loading: boolean;
  loadingProfile: boolean;
  error: string | null;

  fetchCurrentRoute: () => Promise<void>;
  fetchUpcomingRoutes: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateStatus: (status: 'available' | 'offline' | 'on_break') => Promise<void>;
  completeStop: (routeId: string, orderId: string, body: { status: 'delivered' | 'failed'; failureReason?: string }) => Promise<void>;
  uploadPodFiles: (orderId: string, files: Array<{ data: string; filename: string; contentType: string }>) => Promise<string[]>;
  createPod: (orderId: string, data: CreatePodInput) => Promise<void>;
}

export const useDriverStore = create<DriverState>()((set, get) => ({
  currentRoute: null,
  upcomingRoutes: [],
  profile: null,
  loading: false,
  loadingProfile: false,
  error: null,

  fetchCurrentRoute: async () => {
    set({ loading: true, error: null });
    try {
      const route = await api.get<DriverRoute | null>('/driver/current-route');
      set({ currentRoute: route });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load route' });
    } finally {
      set({ loading: false });
    }
  },

  fetchUpcomingRoutes: async () => {
    try {
      const routes = await api.get<DriverRoute[]>('/driver/upcoming-routes');
      set({ upcomingRoutes: routes });
    } catch (err) {
      console.error('Failed to fetch upcoming routes:', err);
    }
  },

  fetchProfile: async () => {
    set({ loadingProfile: true });
    try {
      const profile = await api.get<DriverProfile>('/driver/profile');
      set({ profile });
    } catch (err) {
      console.error('Failed to fetch driver profile:', err);
    } finally {
      set({ loadingProfile: false });
    }
  },

  updateStatus: async (status) => {
    await api.patch('/driver/status', { status });
    const { profile } = get();
    if (profile) {
      set({ profile: { ...profile, status } });
    }
  },

  completeStop: async (routeId, orderId, body) => {
    await api.post(`/routes/${routeId}/stops/${orderId}/complete`, body);
    await get().fetchCurrentRoute();
  },

  uploadPodFiles: async (orderId, files) => {
    const result = await api.post<{ urls: string[] }>('/pod/upload', { orderId, files });
    return result.urls;
  },

  createPod: async (orderId, data) => {
    await api.post(`/pod/${orderId}`, data);
  },
}));
