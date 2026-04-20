import { create } from 'zustand';
import { api } from '../api/client.js';
import { guardDemoWrite } from './demo.js';
import type { CreateVehicleInput, CreateDriverInput } from '@homer-io/shared';

interface Vehicle {
  id: string;
  name: string;
  type: string;
  licensePlate: string | null;
  fuelType: string;
  capacityWeight: string | null;
  capacityVolume: string | null;
  capacityCount: number | null;
  evRange: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Driver {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
  skillTags: string[];
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FleetState {
  vehicles: Vehicle[];
  vehiclePage: number;
  vehicleTotalPages: number;
  vehicleLoading: boolean;

  drivers: Driver[];
  driverPage: number;
  driverTotalPages: number;
  driverLoading: boolean;
  driverStatusFilter: string;
  driverSearch: string;

  fetchVehicles: (page?: number) => Promise<void>;
  createVehicle: (input: CreateVehicleInput) => Promise<void>;
  updateVehicle: (id: string, input: Partial<CreateVehicleInput>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;

  fetchDrivers: (page?: number) => Promise<void>;
  createDriver: (input: CreateDriverInput) => Promise<void>;
  updateDriver: (id: string, input: Partial<CreateDriverInput>) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;
  setDriverStatusFilter: (status: string) => void;
  setDriverSearch: (search: string) => void;
}

export const useFleetStore = create<FleetState>()((set, get) => ({
  vehicles: [],
  vehiclePage: 1,
  vehicleTotalPages: 1,
  vehicleLoading: false,

  drivers: [],
  driverPage: 1,
  driverTotalPages: 1,
  driverLoading: false,
  driverStatusFilter: '',
  driverSearch: '',

  fetchVehicles: async (page = 1) => {
    set({ vehicleLoading: true });
    try {
      const res = await api.get<PaginatedResponse<Vehicle>>(`/fleet/vehicles?page=${page}&limit=20`);
      set({ vehicles: res.items, vehiclePage: res.page, vehicleTotalPages: res.totalPages });
    } finally {
      set({ vehicleLoading: false });
    }
  },

  createVehicle: async (input) => {
    guardDemoWrite('Adding vehicles');
    await api.post('/fleet/vehicles', input);
    await get().fetchVehicles(get().vehiclePage);
  },

  updateVehicle: async (id, input) => {
    guardDemoWrite('Updating vehicles');
    await api.patch(`/fleet/vehicles/${id}`, input);
    await get().fetchVehicles(get().vehiclePage);
  },

  deleteVehicle: async (id) => {
    guardDemoWrite('Deleting vehicles');
    await api.delete(`/fleet/vehicles/${id}`);
    await get().fetchVehicles(get().vehiclePage);
  },

  fetchDrivers: async (page = 1) => {
    set({ driverLoading: true });
    try {
      const { driverStatusFilter, driverSearch } = get();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (driverStatusFilter) params.set('status', driverStatusFilter);
      if (driverSearch) params.set('search', driverSearch);
      const res = await api.get<PaginatedResponse<Driver>>(`/fleet/drivers?${params}`);
      set({ drivers: res.items, driverPage: res.page, driverTotalPages: res.totalPages });
    } finally {
      set({ driverLoading: false });
    }
  },

  createDriver: async (input) => {
    guardDemoWrite('Adding drivers');
    await api.post('/fleet/drivers', input);
    await get().fetchDrivers(get().driverPage);
  },

  updateDriver: async (id, input) => {
    guardDemoWrite('Updating drivers');
    await api.patch(`/fleet/drivers/${id}`, input);
    await get().fetchDrivers(get().driverPage);
  },

  deleteDriver: async (id) => {
    guardDemoWrite('Deleting drivers');
    await api.delete(`/fleet/drivers/${id}`);
    await get().fetchDrivers(get().driverPage);
  },

  // Filter setters reset driver pagination to page 1 so the next fetch doesn't
  // request a now-out-of-range page (which would render an empty table).
  setDriverStatusFilter: (status) => set({ driverStatusFilter: status, driverPage: 1 }),
  setDriverSearch: (search) => set({ driverSearch: search, driverPage: 1 }),
}));
