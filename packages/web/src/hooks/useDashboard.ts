import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
