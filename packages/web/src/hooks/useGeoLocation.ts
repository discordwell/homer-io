import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
}

const LOCATION_POST_INTERVAL = 10_000; // 10 seconds

export function useGeoLocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPostRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPosition: GeoPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
        };
        setPosition(newPosition);
        setError(null);

        // Post location to server at most every 10 seconds
        const now = Date.now();
        if (now - lastPostRef.current >= LOCATION_POST_INTERVAL) {
          lastPostRef.current = now;
          api.post('/tracking/location', {
            lat: newPosition.lat,
            lng: newPosition.lng,
            accuracy: newPosition.accuracy,
            heading: newPosition.heading,
            speed: newPosition.speed,
          }).catch((err) => {
            console.warn('Failed to post location:', err);
          });
        }
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 5_000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return { ...position, error };
}
