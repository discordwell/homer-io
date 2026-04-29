import { useState, useEffect } from 'react';

export type GeoStatus = 'pending' | 'granted' | 'denied';

export interface HeroGeoResult {
  lat: number | null;
  lng: number | null;
  status: GeoStatus;
}

const TIMEOUT_MS = 3000;

export function useHeroGeolocation(): HeroGeoResult {
  const [result, setResult] = useState<HeroGeoResult>(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { lat: null, lng: null, status: 'denied' };
    }
    return { lat: null, lng: null, status: 'pending' };
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // already initialised to 'denied' above
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) {
        setResult({ lat: null, lng: null, status: 'denied' });
        cancelled = true;
      }
    }, TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          clearTimeout(timer);
          setResult({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            status: 'granted',
          });
        }
      },
      () => {
        if (!cancelled) {
          clearTimeout(timer);
          setResult({ lat: null, lng: null, status: 'denied' });
        }
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 300_000 },
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return result;
}
