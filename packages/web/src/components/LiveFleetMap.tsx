import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C, F, alpha } from '../theme.js';
import { useMapPalette, CARTO_ATTRIBUTION, type MapPalette } from '../map-theme.js';
import { useTrackingStore, type DriverLocation } from '../stores/tracking.js';
import { useDemoStore } from '../stores/demo.js';
import { DriverMarker } from './DriverMarker.js';
import { DEMO_ROUTE_PATHS, type DemoRoutePath } from '../data/demo-route-paths.js';

interface LiveFleetMapProps {
  height?: string | number;
  /** Current path index per driver, used to compute completed route portion */
  driverProgress?: Map<string, number>;
}

// Map paint comes from map-theme.ts rather than the CSS-variable tokens in
// theme.ts, because Leaflet may render vectors to Canvas, which cannot resolve
// var(). See the note in map-theme.ts.

export function LiveFleetMap({ height = '100%', driverProgress }: LiveFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The Leaflet map instance lives in state (not a ref) because we read it
  // during render to pass into <DriverMarker />. The compiler rule
  // `react-hooks/refs` rejects ref reads at render time.
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const driverLocations = useTrackingStore((s) => s.driverLocations);
  const isDemo = useDemoStore((s) => s.isDemoMode);

  // Track layers for cleanup
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const palette = useMapPalette();
  const paletteRef = useRef(palette);
  useEffect(() => { paletteRef.current = palette; });

  // Swap basemap tiles in place when the theme changes — recreating the map
  // would drop the user's pan/zoom.
  useEffect(() => {
    tileLayerRef.current?.setUrl(palette.tileUrl);
  }, [palette.tileUrl]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const center: [number, number] = isDemo ? [37.65, -122.20] : [40.7128, -74.006];
    const zoom = isDemo ? 10 : 12;

    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView(center, zoom);

    tileLayerRef.current = L.tileLayer(paletteRef.current.tileUrl, {
      attribution: CARTO_ATTRIBUTION,
    }).addTo(map);

    setMapInstance(map);

    return () => {
      map.remove();
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fit bounds when driver locations change (non-demo only)
  useEffect(() => {
    if (!mapInstance || driverLocations.size === 0 || isDemo) return;

    const points: [number, number][] = [];
    driverLocations.forEach((d) => {
      points.push([d.lat, d.lng]);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocations.size, mapInstance]);

  // Demo: draw route paths, stop markers, completed portion
  useEffect(() => {
    if (!mapInstance || !isDemo) return;

    // Clean up previous layers
    if (routeLayersRef.current) {
      routeLayersRef.current.remove();
    }

    const group = L.layerGroup().addTo(mapInstance);
    routeLayersRef.current = group;

    for (const route of DEMO_ROUTE_PATHS) {
      drawRouteOnMap(group, route, palette, driverProgress?.get(route.driverId));
    }

    return () => {
      if (routeLayersRef.current) {
        routeLayersRef.current.remove();
        routeLayersRef.current = null;
      }
    };
  }, [isDemo, mapInstance, driverProgress, palette]);

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
        border: `1px solid ${C.borderStrong}`,
        position: 'relative',
      }}
    >
      {mapInstance && drivers.map((driver) => (
        <DriverMarker
          key={driver.driverId}
          driver={driver}
          map={mapInstance}
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
            background: C.chrome,
            borderRadius: 10,
            padding: '12px 16px',
            border: `1px solid ${alpha(C.accent, 0.3)}`,
            minWidth: 200,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: C.accentText, marginBottom: 4 }}>
            {activeRoute.routeName}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, marginBottom: 8 }}>
            {activeRoute.driverName} — {activeProgress.completed}/{activeProgress.total} stops
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: alpha(C.text, 0.1), overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              width: `${activeProgress.pct}%`,
              background: `linear-gradient(90deg, ${C.green}, ${C.accent})`,
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

function drawRouteOnMap(group: L.LayerGroup, route: DemoRoutePath, palette: MapPalette, currentPathIndex?: number) {
  const pathLatLngs = route.path.map(([lat, lng]) => L.latLng(lat, lng));
  const isCompleted = route.status === 'completed';

  if (isCompleted) {
    // Completed route: solid green, dimmer
    L.polyline(pathLatLngs, {
      color: palette.green,
      weight: 2,
      opacity: 0.25,
    }).addTo(group);
  } else {
    // In-progress route: dashed amber polyline
    L.polyline(pathLatLngs, {
      color: palette.accent,
      weight: 2.5,
      opacity: 0.4,
      dashArray: '8, 6',
    }).addTo(group);

    // Completed portion: solid green
    if (currentPathIndex != null && currentPathIndex > 0) {
      const completedLatLngs = pathLatLngs.slice(0, currentPathIndex + 1);
      L.polyline(completedLatLngs, {
        color: palette.green,
        weight: 3,
        opacity: 0.7,
      }).addTo(group);
    }
  }

  // Stop markers
  const nextStopIdx = route.stops.findIndex((s) => !s.completed);

  route.stops.forEach((stop, i) => {
    const isCompleted = stop.completed || (currentPathIndex != null && currentPathIndex >= stop.pathIndex);
    const isNext = i === nextStopIdx;

    let color = palette.dim;
    let radius = 5;
    let fillOpacity = 0.4;

    if (isCompleted) {
      color = palette.green;
      radius = 6;
      fillOpacity = 0.8;
    } else if (isNext) {
      color = palette.accent;
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
