import { create } from 'zustand';
import { api } from '../api/client.js';
import type { AnalyticsOverview, DriverPerformance, RouteEfficiency, TrendPoint } from '@homer-io/shared';

interface AnalyticsState {
  overview: AnalyticsOverview | null;
  drivers: DriverPerformance[];
  routeEfficiency: RouteEfficiency | null;
  trends: TrendPoint[];
  range: '7d' | '30d' | '90d';
  loading: boolean;
  setRange: (range: '7d' | '30d' | '90d') => void;
  fetchAll: () => Promise<void>;
  exportCsv: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>()((set, get) => ({
  overview: null,
  drivers: [],
  routeEfficiency: null,
  trends: [],
  range: '7d',
  loading: false,

  setRange: (range) => set({ range }),

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
