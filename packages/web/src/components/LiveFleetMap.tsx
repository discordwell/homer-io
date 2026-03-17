import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../theme.js';
import { useTrackingStore, type DriverLocation } from '../stores/tracking.js';
import { DriverMarker } from './DriverMarker.js';

interface LiveFleetMapProps {
  height?: string | number;
}

export function LiveFleetMap({ height = '100%' }: LiveFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const driverLocations = useTrackingStore((s) => s.driverLocations);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([40.7128, -74.006], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Auto-fit bounds when driver locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || driverLocations.size === 0) return;

    const points: [number, number][] = [];
    driverLocations.forEach((d) => {
      points.push([d.lat, d.lng]);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocations.size]);

  const drivers = Array.from(driverLocations.values());

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${C.muted}`,
        position: 'relative',
      }}
    >
      {mapReady && mapRef.current && drivers.map((driver) => (
        <DriverMarker
          key={driver.driverId}
          driver={driver}
          map={mapRef.current!}
        />
      ))}
    </div>
  );
}
