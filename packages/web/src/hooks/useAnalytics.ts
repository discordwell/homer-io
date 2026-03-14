import { useEffect } from 'react';
import { useAnalyticsStore } from '../stores/analytics.js';

export function useAnalytics() {
  const {
    overview, drivers, routeEfficiency, trends,
    range, setRange, loading, fetchAll, exportCsv,
  } = useAnalyticsStore();

  useEffect(() => {
    fetchAll();
  }, [range, fetchAll]);

  return { overview, drivers, routeEfficiency, trends, range, setRange, loading, exportCsv };
}
