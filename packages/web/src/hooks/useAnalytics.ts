import { useEffect } from 'react';
import { useAnalyticsStore } from '../stores/analytics.js';

export function useAnalytics() {
  const store = useAnalyticsStore();

  useEffect(() => {
    store.fetchEnhanced();
  }, [store.range]);

  return store;
}
