import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { api } from '../api/client.js';
import { useDemoStore } from './demo.js';
import { DEMO_DRIVERS } from '../data/demo-data.js';

export type LocationSource = 'driver_app' | 'samsara' | 'motive' | 'geotab';

export interface DriverLocation {
  driverId: string;
  driverName: string;
  driverStatus: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  updatedAt: string;
  /**
   * Where this position came from. WS pushes carry the real source; the
   * initial REST /tracking/drivers fetch doesn't yet — treat undefined as
   * driver_app for backwards-compat display.
   */
  source?: LocationSource;
  vehicleId?: string | null;
}

export interface RouteProgress {
  routeId: string;
  status: string;
  completedStops: number;
  totalStops: number;
}

export interface DeliveryEventItem {
  id: string;
  routeId: string;
  routeName: string;
  orderId: string;
  recipientName: string;
  status: 'delivered' | 'failed';
  failureReason: string | null;
  timestamp: string;
}

interface TrackingState {
  driverLocations: Map<string, DriverLocation>;
  activeRouteProgress: Map<string, RouteProgress>;
  deliveryEvents: DeliveryEventItem[];
  loading: boolean;

  fetchDriverLocations: () => Promise<void>;
  subscribeToUpdates: (socket: Socket) => void;
  unsubscribe: (socket: Socket) => void;
}

let eventCounter = 0;

export const useTrackingStore = create<TrackingState>()((set) => ({
  driverLocations: new Map(),
  activeRouteProgress: new Map(),
  deliveryEvents: [],
  loading: false,

  fetchDriverLocations: async () => {
    set({ loading: true });
    try {
      const isDemo = useDemoStore.getState().isDemoMode;
      let data: DriverLocation[] = [];
      try {
        data = await api.get<DriverLocation[]>('/tracking/drivers');
      } catch {
        // API may fail in demo mode — fall through to demo fallback
      }
      if (data.length === 0 && isDemo) {
        // Populate from static demo drivers when API returns nothing
        data = DEMO_DRIVERS
          .filter((d) => d.status !== 'offline' && d.lat != null && d.lng != null)
          .map((d) => ({
            driverId: d.id,
            driverName: d.name,
            driverStatus: d.status,
            lat: d.lat!,
            lng: d.lng!,
            speed: d.speed,
            heading: d.heading,
            updatedAt: new Date().toISOString(),
          }));
      }
      const locations = new Map<string, DriverLocation>();
      for (const d of data) {
        locations.set(d.driverId, d);
      }
      set({ driverLocations: locations });
    } finally {
      set({ loading: false });
    }
  },

  subscribeToUpdates: (socket: Socket) => {
    socket.on('driver:location', (data: DriverLocation) => {
      set((state) => {
        const updated = new Map(state.driverLocations);
        updated.set(data.driverId, data);
        return { driverLocations: updated };
      });
    });

    socket.on('route:status', (data: { routeId: string; newStatus: string; routeName?: string }) => {
      set((state) => {
        const updated = new Map(state.activeRouteProgress);
        const existing = updated.get(data.routeId);
        if (existing) {
          updated.set(data.routeId, { ...existing, status: data.newStatus });
        } else {
          updated.set(data.routeId, {
            routeId: data.routeId,
            status: data.newStatus,
            completedStops: 0,
            totalStops: 0,
          });
        }
        return { activeRouteProgress: updated };
      });
    });

    socket.on('delivery:event', (data: Omit<DeliveryEventItem, 'id'>) => {
      set((state) => {
        eventCounter += 1;
        const newEvent: DeliveryEventItem = {
          ...data,
          id: `evt-${eventCounter}-${Date.now()}`,
        };
        const events = [newEvent, ...state.deliveryEvents].slice(0, 50);
        return { deliveryEvents: events };
      });
    });
  },

  unsubscribe: (socket: Socket) => {
    socket.off('driver:location');
    socket.off('route:status');
    socket.off('delivery:event');
  },
}));
