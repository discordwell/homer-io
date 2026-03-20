import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C, F } from '../theme.js';
import { useTrackingStore, type DriverLocation } from '../stores/tracking.js';
import { useAuthStore } from '../stores/auth.js';
import { DriverMarker } from './DriverMarker.js';
import { DEMO_ROUTE_PATHS, type DemoRoutePath } from '../data/demo-route-paths.js';

interface LiveFleetMapProps {
  height?: string | number;
  /** Current path index per driver, used to compute completed route portion */
  driverProgress?: Map<string, number>;
}

// Leaflet needs actual hex colors (CSS vars don't work in SVG/canvas)
const MAP_AMBER = '#F59E0B';
const MAP_GREEN = '#22C55E';
const MAP_DIM = '#6B7280';

export function LiveFleetMap({ height = '100%', driverProgress }: LiveFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const driverLocations = useTrackingStore((s) => s.driverLocations);
  const isDemo = useAuthStore((s) => s.user?.isDemo);

  // Track layers for cleanup
  const routeLayersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = isDemo ? [37.65, -122.20] : [40.7128, -74.006];
    const zoom = isDemo ? 10 : 12;

    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView(center, zoom);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fit bounds when driver locations change (non-demo only)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || driverLocations.size === 0 || isDemo) return;

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

  // Demo: draw route paths, stop markers, completed portion
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isDemo) return;

    // Clean up previous layers
    if (routeLayersRef.current) {
      routeLayersRef.current.remove();
    }

    const group = L.layerGroup().addTo(map);
    routeLayersRef.current = group;

    for (const route of DEMO_ROUTE_PATHS) {
      if (route.status !== 'in_progress') continue;
      drawRouteOnMap(group, route, driverProgress?.get(route.driverId));
    }

    return () => {
      if (routeLayersRef.current) {
        routeLayersRef.current.remove();
        routeLayersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, mapReady, driverProgress]);

  const drivers = Array.from(driverLocations.values());

  // Find the in-progress route for the progress panel
  const activeRoute = isDemo
    ? DEMO_ROUTE_PATHS.find((r) => r.status === 'in_progress')
    : null;

  const activeProgress = activeRoute ? getRouteProgress(activeRoute, driverProgress?.get(activeRoute.driverId)) : null;

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

      {/* Route progress panel — demo only */}
      {isDemo && activeRoute && activeProgress && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 1000,
            background: 'rgba(6, 9, 15, 0.92)',
            borderRadius: 10,
            padding: '12px 16px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            minWidth: 200,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: MAP_AMBER, marginBottom: 4 }}>
            {activeRoute.routeName}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
            {activeRoute.driverName} — {activeProgress.completed}/{activeProgress.total} stops
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              width: `${activeProgress.pct}%`,
              background: `linear-gradient(90deg, ${MAP_GREEN}, ${MAP_AMBER})`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawRouteOnMap(group: L.LayerGroup, route: DemoRoutePath, currentPathIndex?: number) {
  const pathLatLngs = route.path.map(([lat, lng]) => L.latLng(lat, lng));

  // Full route: dashed amber polyline
  L.polyline(pathLatLngs, {
    color: MAP_AMBER,
    weight: 2.5,
    opacity: 0.4,
    dashArray: '8, 6',
  }).addTo(group);

  // Completed portion: solid green
  if (currentPathIndex != null && currentPathIndex > 0) {
    const completedLatLngs = pathLatLngs.slice(0, currentPathIndex + 1);
    L.polyline(completedLatLngs, {
      color: MAP_GREEN,
      weight: 3,
      opacity: 0.7,
    }).addTo(group);
  }

  // Stop markers
  const nextStopIdx = route.stops.findIndex((s) => !s.completed);

  route.stops.forEach((stop, i) => {
    const isCompleted = stop.completed || (currentPathIndex != null && currentPathIndex >= stop.pathIndex);
    const isNext = i === nextStopIdx;

    let color = MAP_DIM;
    let radius = 5;
    let fillOpacity = 0.4;

    if (isCompleted) {
      color = MAP_GREEN;
      radius = 6;
      fillOpacity = 0.8;
    } else if (isNext) {
      color = MAP_AMBER;
      radius = 8;
      fillOpacity = 0.9;
    }

    const marker = L.circleMarker([stop.lat, stop.lng], {
      radius,
      color,
      fillColor: color,
      fillOpacity,
      weight: isNext ? 3 : 2,
      opacity: isCompleted || isNext ? 1 : 0.5,
    }).addTo(group);

    marker.bindTooltip(`${stop.name}${isCompleted ? ' (done)' : isNext ? ' (next)' : ''}`, {
      permanent: false,
      direction: 'top',
      offset: [0, -8],
    });
  });
}

function getRouteProgress(route: DemoRoutePath, currentPathIndex?: number) {
  // Count completed stops based on driver's current path position
  let completed = route.stops.filter((s) => s.completed).length;
  if (currentPathIndex != null) {
    completed = route.stops.filter((s) => s.completed || currentPathIndex >= s.pathIndex).length;
  }
  const total = route.stops.length;
  const pct = Math.round((completed / total) * 100);
  return { completed, total, pct };
}
