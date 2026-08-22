import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../theme.js';
import { useMapPalette, CARTO_ATTRIBUTION } from '../map-theme.js';

interface Stop { lat: number; lng: number; label?: string; }
interface RouteMapProps { stops?: Stop[]; center?: [number, number]; zoom?: number; height?: number | string; onClick?: (lat: number, lng: number) => void; }

export function RouteMap({ stops = [], center = [40.7128, -74.006], zoom = 12, height = 400, onClick }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const palette = useMapPalette();
  const onClickRef = useRef(onClick);
  const paletteRef = useRef(palette);
  // Signature of the geometry the view was last fitted to. A theme change
  // re-runs the draw effect (colors are baked into the layers at creation),
  // but must not re-fit — that would throw away the user's pan/zoom, which is
  // the whole reason tiles are swapped in place rather than remounting.
  const fittedRef = useRef<string>('');
  useEffect(() => {
    onClickRef.current = onClick;
    paletteRef.current = palette;
  });

  // Swap basemap tiles in place when the theme changes — recreating the map
  // would drop the user's pan/zoom.
  useEffect(() => {
    tileLayerRef.current?.setUrl(palette.tileUrl);
  }, [palette.tileUrl]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(center, zoom);
    tileLayerRef.current = L.tileLayer(paletteRef.current.tileUrl, {
      attribution: CARTO_ATTRIBUTION,
    }).addTo(map);
    mapRef.current = map;

    // Try to center on user's location if no custom center was provided
    if (center[0] === 40.7128 && center[1] === -74.006) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], zoom); },
        () => {}, // keep default on denial
        { timeout: 3000 },
      );
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      onClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers/polylines
    map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) map.removeLayer(layer);
    });

    if (stops.length === 0) return;

    stops.forEach((stop, i) => {
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 8, fillColor: palette.accent, fillOpacity: 1,
        color: palette.markerStroke, weight: 2,
      }).addTo(map);
      marker.bindTooltip(stop.label || `Stop ${i + 1}`, { permanent: false });
    });

    if (stops.length > 1) {
      L.polyline(stops.map(s => [s.lat, s.lng] as [number, number]), {
        color: palette.accent, weight: 3, opacity: 0.7, dashArray: '8, 8',
      }).addTo(map);
    }

    const fitKey = stops.map(s => `${s.lat},${s.lng}`).join('|');
    if (fitKey !== fittedRef.current) {
      fittedRef.current = fitKey;
      const bounds = L.latLngBounds(stops.map(s => [s.lat, s.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stops, palette]);

  return <div ref={containerRef} style={{ height, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.borderStrong}` }} />;
}
