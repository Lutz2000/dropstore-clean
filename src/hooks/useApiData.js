/**
 * useApiData — generic data-fetching hook with:
 *  - Offline-first: serves stale cache instantly, then refreshes in background
 *  - Background refresh when user brings the app to foreground (AppState)
 *  - Optional polling interval for live-dashboard data (e.g. admin KPIs)
 *  - Graceful degradation: if network fails and cache exists, show cache
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApiData('/settings', { ttl: SETTINGS_TTL });
 *   const { data } = useApiData('/products', { interval: 60000 });  // poll every 60s
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import client from '../api/client';
import { getCached, setCached, DEFAULT_TTL } from '../api/cache';

export function useApiData(endpoint, { ttl = DEFAULT_TTL, interval = null, params = null } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const appState              = useRef(AppState.currentState);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    // 1. Serve cached data immediately (offline-first UX)
    const cacheKey = params ? `${endpoint}?${JSON.stringify(params)}` : endpoint;
    const cached   = await getCached(cacheKey);
    if (cached !== null) {
      setData(cached);
      if (!silent) setLoading(false);
    }

    // 2. Attempt live fetch
    try {
      const res = await client.get(endpoint, params ? { params } : undefined);
      setData(res.data);
      await setCached(cacheKey, res.data, ttl);
      setError(null);
    } catch (err) {
      // If we already have cached data don't surface the error to the UI
      if (cached === null) setError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [endpoint, ttl, params]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch silently when app returns to foreground (admin may have updated data)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchData({ silent: true });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [fetchData]);

  // Optional polling — useful for dashboard metrics / notifications
  useEffect(() => {
    if (!interval) return;
    const id = setInterval(() => fetchData({ silent: true }), interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  return { data, loading, error, refetch: fetchData };
}
