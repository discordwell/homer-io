import { create } from 'zustand';
import { api } from '@/api/client';

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  licensePlate: string;
  fuelType: string;
  isActive: boolean;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

interface FleetState {
  vehicles: Vehicle[];
  drivers: Driver[];
  loading: boolean;
  fetchVehicles: () => Promise<void>;
  fetchDrivers: () => Promise<void>;
}

export const useFleetStore = create<FleetState>()((set) => ({
  vehicles: [],
  drivers: [],
  loading: false,

  fetchVehicles: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ items: Vehicle[] }>('/fleet/vehicles?limit=100');
      set({ vehicles: res.items });
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchDrivers: async () => {
    set({ loading: true });
    try {
      const res = await api.get<{ items: Driver[] }>('/fleet/drivers?limit=100');
      set({ drivers: res.items });
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
    } finally {
      set({ loading: false });
    }
  },
}));
