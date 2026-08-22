import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../../theme.js';
import { useMapPalette, CARTO_ATTRIBUTION } from '../../map-theme.js';

interface TrackingMapProps {
  driverLat?: number;
  driverLng?: number;
  destLat?: number;
  destLng?: number;
}

export function TrackingMap({ driverLat, driverLng, destLat, destLng }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const palette = useMapPalette();
  const paletteRef = useRef(palette);
  // See RouteMap: re-fitting on a theme change would discard the user's view.
  const fittedRef = useRef<string>('');
  useEffect(() => { paletteRef.current = palette; });

  // Swap basemap tiles in place when the theme changes.
  useEffect(() => {
    tileLayerRef.current?.setUrl(palette.tileUrl);
  }, [palette.tileUrl]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = [
      driverLat ?? destLat ?? 40.7128,
      driverLng ?? destLng ?? -74.006,
    ];

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 13);

    tileLayerRef.current = L.tileLayer(paletteRef.current.tileUrl, {
      attribution: CARTO_ATTRIBUTION,
    }).addTo(map);

    // Add attribution control in bottom-right
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const bounds: [number, number][] = [];

    // Driver marker — pulsing blue dot
    if (driverLat != null && driverLng != null) {
      // Outer pulse ring
      L.circleMarker([driverLat, driverLng], {
        radius: 16,
        fillColor: palette.accent,
        fillOpacity: 0.2,
        color: palette.accent,
        weight: 1,
        opacity: 0.4,
        className: 'driver-pulse',
      }).addTo(map);

      // Inner dot
      L.circleMarker([driverLat, driverLng], {
        radius: 7,
        fillColor: palette.accent,
        fillOpacity: 1,
        color: palette.markerStroke,
        weight: 2,
      })
        .bindTooltip('Driver', { permanent: false })
        .addTo(map);

      bounds.push([driverLat, driverLng]);
    }

    // Destination marker — red pin
    if (destLat != null && destLng != null) {
      L.circleMarker([destLat, destLng], {
        radius: 9,
        fillColor: palette.red,
        fillOpacity: 1,
        color: palette.markerStroke,
        weight: 2,
      })
        .bindTooltip('Destination', { permanent: false })
        .addTo(map);

      bounds.push([destLat, destLng]);
    }

    const fitKey = bounds.map(([a, b]) => `${a},${b}`).join('|');
    if (fitKey !== fittedRef.current) {
      fittedRef.current = fitKey;
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      }
    }
  }, [driverLat, driverLng, destLat, destLng, palette]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          height: 300,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${C.borderStrong}`,
        }}
      />
      <style>{`
        .driver-pulse {
          animation: driverPulse 2s ease-in-out infinite;
        }
        @keyframes driverPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.1; }
        }
      `}</style>
    </>
  );
}
