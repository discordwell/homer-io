import { create } from 'zustand';
import { api } from '../api/client.js';
import type {
  AnalyticsOverview, DriverPerformance, RouteEfficiency, TrendPoint,
  EnhancedOverview, EnhancedDriverPerformance, EnhancedRouteEfficiency,
  EnhancedTrendPoint, HeatmapCell, Insight, DeliveryOutcomes,
} from '@homer-io/shared';

interface AnalyticsState {
  // Legacy (kept for backward compat)
  overview: AnalyticsOverview | null;
  drivers: DriverPerformance[];
  routeEfficiency: RouteEfficiency | null;
  trends: TrendPoint[];

  // Enhanced
  enhancedOverview: EnhancedOverview | null;
  enhancedDrivers: EnhancedDriverPerformance[];
  enhancedRoutes: EnhancedRouteEfficiency | null;
  enhancedTrends: EnhancedTrendPoint[];
  heatmap: HeatmapCell[];
  insights: Insight[];
  outcomes: DeliveryOutcomes | null;

  range: '7d' | '30d' | '90d';
  loading: boolean;
  activeTab: 'drivers' | 'routes' | 'outcomes';

  setRange: (range: '7d' | '30d' | '90d') => void;
  setActiveTab: (tab: 'drivers' | 'routes' | 'outcomes') => void;
  fetchAll: () => Promise<void>;
  fetchEnhanced: () => Promise<void>;
  exportCsv: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>()((set, get) => ({
  overview: null,
  drivers: [],
  routeEfficiency: null,
  trends: [],
  enhancedOverview: null,
  enhancedDrivers: [],
  enhancedRoutes: null,
  enhancedTrends: [],
  heatmap: [],
  insights: [],
  outcomes: null,
  range: '7d',
  loading: false,
  activeTab: 'drivers',

  setRange: (range) => set({ range }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchAll: async () => {
    set({ loading: true });
    try {
      const { range } = get();
      const params = `?range=${range}`;
      const [overview, drivers, routeEfficiency, trends] = await Promise.all([
        api.get<AnalyticsOverview>(`/analytics/overview${params}`),
        api.get<DriverPerformance[]>(`/analytics/drivers${params}`),
        api.get<RouteEfficiency>(`/analytics/routes${params}`),
        api.get<TrendPoint[]>(`/analytics/trends${params}`),
      ]);
      set({ overview, drivers, routeEfficiency, trends });
    } finally {
      set({ loading: false });
    }
  },

  fetchEnhanced: async () => {
    set({ loading: true });
    try {
      const { range } = get();
      const params = `?range=${range}`;
      const [enhancedOverview, enhancedDrivers, enhancedRoutes, enhancedTrends, heatmap, insights, outcomes] = await Promise.all([
        api.get<EnhancedOverview>(`/analytics/enhanced/overview${params}`),
        api.get<EnhancedDriverPerformance[]>(`/analytics/enhanced/drivers${params}`),
        api.get<EnhancedRouteEfficiency>(`/analytics/enhanced/routes${params}`),
        api.get<EnhancedTrendPoint[]>(`/analytics/enhanced/trends${params}`),
        api.get<HeatmapCell[]>(`/analytics/heatmap${params}`),
        api.get<Insight[]>(`/analytics/insights${params}`),
        api.get<DeliveryOutcomes>(`/analytics/outcomes${params}`),
      ]);
      set({ enhancedOverview, enhancedDrivers, enhancedRoutes, enhancedTrends, heatmap, insights, outcomes });
    } finally {
      set({ loading: false });
    }
  },

  exportCsv: async () => {
    const { range } = get();
    const { useAuthStore } = await import('../stores/auth.js');
    const { accessToken } = useAuthStore.getState();
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${API_BASE}/analytics/export/csv?range=${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to export CSV');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
}));
