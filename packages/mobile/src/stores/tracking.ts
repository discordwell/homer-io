import { create } from 'zustand';
import { api } from '@/api/client';
import type { Socket } from 'socket.io-client';

export interface DriverLocation {
  driverId: string;
  driverName: string;
  driverStatus: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  updatedAt: string;
}

export interface DeliveryEventItem {
  id: string;
  routeId: string;
  routeName: string;
  orderId: string;
  recipientName: string;
  status: 'delivered' | 'failed';
  failureReason?: string;
  timestamp: string;
}

interface TrackingState {
  driverLocations: Map<string, DriverLocation>;
  deliveryEvents: DeliveryEventItem[];
  loading: boolean;

  fetchDriverLocations: () => Promise<void>;
  subscribeToUpdates: (socket: Socket) => void;
  unsubscribe: (socket: Socket) => void;
}

export const useTrackingStore = create<TrackingState>()((set, _get) => ({
  driverLocations: new Map(),
  deliveryEvents: [],
  loading: false,

  fetchDriverLocations: async () => {
    set({ loading: true });
    try {
      const locations = await api.get<DriverLocation[]>('/tracking/drivers');
      const map = new Map<string, DriverLocation>();
      locations.forEach((loc) => map.set(loc.driverId, loc));
      set({ driverLocations: map });
    } catch (err) {
      console.error('Failed to fetch driver locations:', err);
    } finally {
      set({ loading: false });
    }
  },

  subscribeToUpdates: (socket) => {
    socket.on('driver:location', (data: DriverLocation) => {
      set((state) => {
        const newMap = new Map(state.driverLocations);
        newMap.set(data.driverId, data);
        return { driverLocations: newMap };
      });
    });

    socket.on('delivery:event', (event: DeliveryEventItem) => {
      set((state) => ({
        deliveryEvents: [event, ...state.deliveryEvents].slice(0, 50),
      }));
    });
  },

  unsubscribe: (socket) => {
    socket.off('driver:location');
    socket.off('delivery:event');
  },
}));
