import { useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { usePollingWithBackoff } from './usePollingWithBackoff.js';

interface RecentOrder {
  id: string;
  recipientName: string;
  status: string;
  priority: string;
  packageCount: number;
  createdAt: string;
}

interface DashboardStats {
  ordersToday: number;
  activeRoutes: number;
  activeDrivers: number;
  deliveryRate: number;
  totalVehicles: number;
  recentOrders: RecentOrder[];
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get<DashboardStats>('/dashboard/stats');
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      // Rethrow so the polling hook backs off on consecutive failures.
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 60s with exponential backoff on failure (60s → 2m → 4m → 5m cap).
  usePollingWithBackoff(fetchStats, { baseIntervalMs: 60_000 });

  return { stats, loading, error, refetch: fetchStats };
}
