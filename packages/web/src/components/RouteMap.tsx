import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../theme.js';

interface Stop { lat: number; lng: number; label?: string; }
interface RouteMapProps { stops?: Stop[]; center?: [number, number]; zoom?: number; height?: number | string; onClick?: (lat: number, lng: number) => void; }

export function RouteMap({ stops = [], center = [40.7128, -74.006], zoom = 12, height = 400, onClick }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(center, zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);
    mapRef.current = map;

    if (onClick) {
      map.on('click', (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng));
    }

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers/polylines
    map.eachLayer(layer => { if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); });

    if (stops.length === 0) return;

    stops.forEach((stop, i) => {
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: 8, fillColor: C.accent, fillOpacity: 1,
        color: '#fff', weight: 2,
      }).addTo(map);
      marker.bindTooltip(stop.label || `Stop ${i + 1}`, { permanent: false });
    });

    if (stops.length > 1) {
      L.polyline(stops.map(s => [s.lat, s.lng] as [number, number]), {
        color: C.accent, weight: 3, opacity: 0.7, dashArray: '8, 8',
      }).addTo(map);
    }

    const bounds = L.latLngBounds(stops.map(s => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [stops]);

  return <div ref={containerRef} style={{ height, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.muted}` }} />;
}
